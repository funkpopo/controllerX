use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use crate::profiles::XInputDriverEvidence;

const NEGATIVE_CACHE_TTL: Duration = Duration::from_secs(2);

#[derive(Clone, Debug)]
struct CacheEntry {
    checked_at: Instant,
    evidence: Option<XInputDriverEvidence>,
}

static XINPUT_DRIVER_CACHE: OnceLock<Mutex<HashMap<(u16, u16), CacheEntry>>> = OnceLock::new();

pub fn xinput_driver_evidence(vendor_id: u16, product_id: u16) -> Option<XInputDriverEvidence> {
    let key = (vendor_id, product_id);
    let now = Instant::now();
    let cache = XINPUT_DRIVER_CACHE.get_or_init(|| Mutex::new(HashMap::new()));

    if let Ok(guard) = cache.lock() {
        if let Some(entry) = guard.get(&key) {
            let is_fresh_negative = entry.evidence.is_none()
                && now.duration_since(entry.checked_at) < NEGATIVE_CACHE_TTL;
            if entry.evidence.is_some() || is_fresh_negative {
                return entry.evidence.clone();
            }
        }
    }

    let evidence = platform_xinput_driver_evidence(vendor_id, product_id);

    if let Ok(mut guard) = cache.lock() {
        guard.insert(
            key,
            CacheEntry {
                checked_at: now,
                evidence: evidence.clone(),
            },
        );
    }

    evidence
}

#[cfg(target_os = "windows")]
fn platform_xinput_driver_evidence(
    vendor_id: u16,
    product_id: u16,
) -> Option<XInputDriverEvidence> {
    windows_pnp::xinput_driver_evidence(vendor_id, product_id)
}

#[cfg(not(target_os = "windows"))]
fn platform_xinput_driver_evidence(
    _vendor_id: u16,
    _product_id: u16,
) -> Option<XInputDriverEvidence> {
    None
}

#[cfg(target_os = "windows")]
mod windows_pnp {
    use std::mem::size_of;
    use std::ptr::{null, null_mut};

    use windows_sys::Win32::Devices::DeviceAndDriverInstallation::{
        SetupDiDestroyDeviceInfoList, SetupDiEnumDeviceInfo, SetupDiGetClassDevsW,
        SetupDiGetDeviceInstanceIdW, SetupDiGetDeviceRegistryPropertyW, DIGCF_ALLCLASSES,
        DIGCF_PRESENT, HDEVINFO, SPDRP_CLASS, SPDRP_COMPATIBLEIDS, SPDRP_HARDWAREID, SPDRP_SERVICE,
        SP_DEVINFO_DATA,
    };
    use windows_sys::Win32::Foundation::{
        GetLastError, ERROR_INSUFFICIENT_BUFFER, ERROR_NO_MORE_ITEMS,
    };
    use windows_sys::Win32::System::Registry::{REG_MULTI_SZ, REG_SZ};

    use crate::profiles::XInputDriverEvidence;

    pub(super) fn xinput_driver_evidence(
        vendor_id: u16,
        product_id: u16,
    ) -> Option<XInputDriverEvidence> {
        let needle = format!("VID_{vendor_id:04X}&PID_{product_id:04X}");
        let device_info_set =
            unsafe { SetupDiGetClassDevsW(null(), null(), null_mut(), device_enumeration_flags()) };
        if device_info_set == -1isize {
            return None;
        }
        let _guard = DeviceInfoSet(device_info_set);

        let mut member_index = 0;
        loop {
            let mut info = SP_DEVINFO_DATA {
                cbSize: size_of::<SP_DEVINFO_DATA>() as u32,
                ..SP_DEVINFO_DATA::default()
            };

            let ok = unsafe {
                SetupDiEnumDeviceInfo(device_info_set, member_index, &mut info as *mut _)
            };
            if ok == 0 {
                if unsafe { GetLastError() } == ERROR_NO_MORE_ITEMS {
                    break;
                }
                member_index += 1;
                continue;
            }
            member_index += 1;

            let Some(instance_id) = device_instance_id(device_info_set, &info) else {
                continue;
            };
            if !contains_vid_pid(&instance_id, &needle) {
                continue;
            }

            let class_names = registry_strings(device_info_set, &info, SPDRP_CLASS);
            let services = registry_strings(device_info_set, &info, SPDRP_SERVICE);
            let compatible_ids = registry_strings(device_info_set, &info, SPDRP_COMPATIBLEIDS);
            let hardware_ids = registry_strings(device_info_set, &info, SPDRP_HARDWAREID);

            if !has_xinput_driver_evidence(&class_names, &services, &compatible_ids, &hardware_ids)
            {
                continue;
            }

            return Some(XInputDriverEvidence {
                source: "windows-pnp".to_string(),
                device_instance_id: instance_id,
                class_name: class_names.into_iter().next(),
                service: services.into_iter().next(),
                compatible_ids: compatible_ids
                    .into_iter()
                    .filter(|value| is_xinput_compatible_id(value))
                    .collect(),
            });
        }

        None
    }

    fn device_enumeration_flags() -> u32 {
        DIGCF_PRESENT | DIGCF_ALLCLASSES
    }

    fn has_xinput_driver_evidence(
        class_names: &[String],
        services: &[String],
        compatible_ids: &[String],
        hardware_ids: &[String],
    ) -> bool {
        class_names
            .iter()
            .any(|value| value.eq_ignore_ascii_case("XnaComposite"))
            || services.iter().any(|value| {
                let normalized = value.to_ascii_lowercase();
                normalized == "xusb" || normalized.starts_with("xusb")
            })
            || compatible_ids
                .iter()
                .chain(hardware_ids.iter())
                .any(|value| is_xinput_compatible_id(value))
    }

    fn is_xinput_compatible_id(value: &str) -> bool {
        let normalized = value.to_ascii_uppercase();
        normalized.contains("MS_COMP_XUSB") || normalized.contains("CLASS_FF&SUBCLASS_5D&PROT_01")
    }

    fn contains_vid_pid(value: &str, needle: &str) -> bool {
        value.to_ascii_uppercase().contains(needle)
    }

    fn device_instance_id(device_info_set: HDEVINFO, info: &SP_DEVINFO_DATA) -> Option<String> {
        let mut required_chars = 0;
        unsafe {
            SetupDiGetDeviceInstanceIdW(
                device_info_set,
                info as *const _,
                null_mut(),
                0,
                &mut required_chars,
            );
        }

        let len = required_chars.max(256) as usize;
        let mut buffer = vec![0u16; len];
        let ok = unsafe {
            SetupDiGetDeviceInstanceIdW(
                device_info_set,
                info as *const _,
                buffer.as_mut_ptr(),
                buffer.len() as u32,
                &mut required_chars,
            )
        };

        if ok == 0 {
            return None;
        }

        Some(decode_single_wide_string(&buffer))
    }

    fn registry_strings(
        device_info_set: HDEVINFO,
        info: &SP_DEVINFO_DATA,
        property: u32,
    ) -> Vec<String> {
        let mut reg_type = 0;
        let mut required_bytes = 0;
        let first_ok = unsafe {
            SetupDiGetDeviceRegistryPropertyW(
                device_info_set,
                info as *const _,
                property,
                &mut reg_type,
                null_mut(),
                0,
                &mut required_bytes,
            )
        };

        if first_ok == 0 {
            let last_error = unsafe { GetLastError() };
            if last_error != ERROR_INSUFFICIENT_BUFFER || required_bytes == 0 {
                return Vec::new();
            }
        }

        let wide_len = ((required_bytes as usize + 1) / 2).max(1);
        let mut buffer = vec![0u16; wide_len];
        let ok = unsafe {
            SetupDiGetDeviceRegistryPropertyW(
                device_info_set,
                info as *const _,
                property,
                &mut reg_type,
                buffer.as_mut_ptr() as *mut u8,
                (buffer.len() * 2) as u32,
                &mut required_bytes,
            )
        };

        if ok == 0 {
            return Vec::new();
        }

        match reg_type {
            REG_SZ => {
                let value = decode_single_wide_string(&buffer);
                if value.is_empty() {
                    Vec::new()
                } else {
                    vec![value]
                }
            }
            REG_MULTI_SZ => decode_multi_wide_string(&buffer),
            _ => Vec::new(),
        }
    }

    fn decode_single_wide_string(buffer: &[u16]) -> String {
        let len = buffer
            .iter()
            .position(|value| *value == 0)
            .unwrap_or(buffer.len());
        String::from_utf16_lossy(&buffer[..len])
    }

    fn decode_multi_wide_string(buffer: &[u16]) -> Vec<String> {
        let mut values = Vec::new();
        let mut start = 0;

        for (index, value) in buffer.iter().enumerate() {
            if *value != 0 {
                continue;
            }

            if start == index {
                break;
            }

            values.push(String::from_utf16_lossy(&buffer[start..index]));
            start = index + 1;
        }

        values
    }

    struct DeviceInfoSet(HDEVINFO);

    impl Drop for DeviceInfoSet {
        fn drop(&mut self) {
            unsafe {
                SetupDiDestroyDeviceInfoList(self.0);
            }
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn accepts_xna_composite_driver_class() {
            assert!(has_xinput_driver_evidence(
                &[String::from("XnaComposite")],
                &[],
                &[],
                &[]
            ));
        }

        #[test]
        fn accepts_xusb_service_and_compatible_id() {
            assert!(has_xinput_driver_evidence(
                &[],
                &[String::from("xusb22")],
                &[String::from("USB\\MS_COMP_XUSB10")],
                &[]
            ));
        }

        #[test]
        fn rejects_same_vid_pid_without_xinput_driver_evidence() {
            assert!(!has_xinput_driver_evidence(
                &[String::from("HIDClass")],
                &[String::from("HidUsb")],
                &[String::from("USB\\Class_03")],
                &[]
            ));
        }

        #[test]
        fn enumerates_present_devices_across_all_setup_classes() {
            assert_eq!(device_enumeration_flags(), DIGCF_PRESENT | DIGCF_ALLCLASSES);
        }
    }
}
