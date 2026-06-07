use gilrs::{Axis, Button, Gamepad};
use serde::Serialize;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ControllerFamily {
    Xbox,
    PlayStation,
    XInput,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ProfileId {
    Xbox360,
    XboxOne,
    XboxSeries,
    DualShock3,
    DualShock4,
    DualSense,
    GenericXInput,
}

impl ProfileId {
    pub fn as_str(self) -> &'static str {
        match self {
            ProfileId::Xbox360 => "xbox-360",
            ProfileId::XboxOne => "xbox-one",
            ProfileId::XboxSeries => "xbox-series",
            ProfileId::DualShock3 => "dualshock-3",
            ProfileId::DualShock4 => "dualshock-4",
            ProfileId::DualSense => "dualsense",
            ProfileId::GenericXInput => "generic-xinput",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "xbox-360" => Some(ProfileId::Xbox360),
            "xbox-one" => Some(ProfileId::XboxOne),
            "xbox-series" => Some(ProfileId::XboxSeries),
            "dualshock-3" => Some(ProfileId::DualShock3),
            "dualshock-4" => Some(ProfileId::DualShock4),
            "dualsense" => Some(ProfileId::DualSense),
            "generic-xinput" => Some(ProfileId::GenericXInput),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DeviceMatchKind {
    VendorProduct,
    XInputName,
}

#[derive(Clone, Copy, Debug)]
pub struct ControllerProfile {
    pub id: ProfileId,
    pub display_name: &'static str,
    pub family: ControllerFamily,
    pub preset_id: Option<&'static str>,
    pub match_kind: DeviceMatchKind,
    pub input_map: InputMap,
    pub transform: ProfileTransform,
    pub calibration_status: CalibrationStatus,
}

#[derive(Clone, Copy, Debug)]
struct VendorProductProfile {
    vendor_id: u16,
    product_id: u16,
    profile_id: ProfileId,
    input_map: InputMap,
    transform: ProfileTransform,
}

#[derive(Clone, Copy, Debug)]
pub struct InputMap {
    pub south: Button,
    pub east: Button,
    pub west: Button,
    pub north: Button,
    pub left_bumper: Button,
    pub right_bumper: Button,
    pub left_trigger_button: Option<Button>,
    pub right_trigger_button: Option<Button>,
    pub select: Button,
    pub start: Button,
    pub mode: Button,
    pub left_thumb: Button,
    pub right_thumb: Button,
    pub dpad_up: Button,
    pub dpad_down: Button,
    pub dpad_left: Button,
    pub dpad_right: Button,
    pub left_stick_x: Axis,
    pub left_stick_y: Axis,
    pub right_stick_x: Axis,
    pub right_stick_y: Axis,
    pub left_trigger_axis: Axis,
    pub right_trigger_axis: Axis,
    pub dpad_x: Option<Axis>,
    pub dpad_y: Option<Axis>,
    pub extra_buttons: ExtraButtonMap,
}

#[derive(Clone, Copy, Debug)]
pub struct ExtraButtonMap {
    pub misc1: Option<RawButtonCode>,
    pub paddle1: Option<RawButtonCode>,
    pub paddle2: Option<RawButtonCode>,
    pub paddle3: Option<RawButtonCode>,
    pub paddle4: Option<RawButtonCode>,
    pub touchpad: Option<RawButtonCode>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RawButtonCode {
    pub packed_gilrs_code: u32,
}

#[derive(Clone, Copy, Debug)]
pub struct ProfileTransform {
    pub invert_left_y: bool,
    pub invert_right_y: bool,
    pub invert_dpad_y: bool,
    pub left_trigger_axis_mode: TriggerAxisMode,
    pub right_trigger_axis_mode: TriggerAxisMode,
}

#[derive(Clone, Copy, Debug)]
pub enum TriggerAxisMode {
    PositiveZeroToOne,
    SignedMinusOneToOne,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalibrationStatus {
    pub preset_calibrated: bool,
    pub input_map_calibrated: bool,
    pub hardware_verified: bool,
    pub notes: &'static str,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceIdentity {
    pub id: String,
    pub name: String,
    pub vendor_id: Option<u16>,
    pub product_id: Option<u16>,
    pub uuid: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileInfo {
    pub id: String,
    pub display_name: String,
    pub family: ControllerFamily,
    pub preset_id: Option<String>,
    pub match_kind: DeviceMatchKind,
    pub calibration_status: CalibrationStatus,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnsupportedDevice {
    pub reason: String,
    pub identity: DeviceIdentity,
}

const STANDARD_MAP: InputMap = InputMap {
    south: Button::South,
    east: Button::East,
    west: Button::West,
    north: Button::North,
    left_bumper: Button::LeftTrigger,
    right_bumper: Button::RightTrigger,
    left_trigger_button: None,
    right_trigger_button: None,
    select: Button::Select,
    start: Button::Start,
    mode: Button::Mode,
    left_thumb: Button::LeftThumb,
    right_thumb: Button::RightThumb,
    dpad_up: Button::DPadUp,
    dpad_down: Button::DPadDown,
    dpad_left: Button::DPadLeft,
    dpad_right: Button::DPadRight,
    left_stick_x: Axis::LeftStickX,
    left_stick_y: Axis::LeftStickY,
    right_stick_x: Axis::RightStickX,
    right_stick_y: Axis::RightStickY,
    left_trigger_axis: Axis::LeftZ,
    right_trigger_axis: Axis::RightZ,
    dpad_x: None,
    dpad_y: None,
    extra_buttons: NO_EXTRA_BUTTONS,
};

const NO_EXTRA_BUTTONS: ExtraButtonMap = ExtraButtonMap {
    misc1: None,
    paddle1: None,
    paddle2: None,
    paddle3: None,
    paddle4: None,
    touchpad: None,
};

const DUALSHOCK4_EXTRA_BUTTONS: ExtraButtonMap = ExtraButtonMap {
    touchpad: Some(RawButtonCode {
        packed_gilrs_code: 13,
    }),
    ..NO_EXTRA_BUTTONS
};

const DUALSENSE_EXTRA_BUTTONS: ExtraButtonMap = ExtraButtonMap {
    misc1: Some(RawButtonCode {
        packed_gilrs_code: 14,
    }),
    touchpad: Some(RawButtonCode {
        packed_gilrs_code: 13,
    }),
    ..NO_EXTRA_BUTTONS
};

const DUALSHOCK4_MAP: InputMap = InputMap {
    extra_buttons: DUALSHOCK4_EXTRA_BUTTONS,
    ..STANDARD_MAP
};

const DUALSENSE_MAP: InputMap = InputMap {
    extra_buttons: DUALSENSE_EXTRA_BUTTONS,
    ..STANDARD_MAP
};

const STANDARD_TRANSFORM: ProfileTransform = ProfileTransform {
    invert_left_y: false,
    invert_right_y: false,
    invert_dpad_y: false,
    left_trigger_axis_mode: TriggerAxisMode::PositiveZeroToOne,
    right_trigger_axis_mode: TriggerAxisMode::PositiveZeroToOne,
};

const SIGNED_TRIGGER_TRANSFORM: ProfileTransform = ProfileTransform {
    left_trigger_axis_mode: TriggerAxisMode::SignedMinusOneToOne,
    right_trigger_axis_mode: TriggerAxisMode::SignedMinusOneToOne,
    ..STANDARD_TRANSFORM
};

const CALIBRATED_WITH_INCLUDED_PRESET: CalibrationStatus = CalibrationStatus {
    preset_calibrated: false,
    input_map_calibrated: false,
    hardware_verified: false,
    notes: "Static profile and preset wiring are implemented; real hardware calibration remains required.",
};

const NEEDS_DS4_ASSET: CalibrationStatus = CalibrationStatus {
    preset_calibrated: false,
    input_map_calibrated: true,
    hardware_verified: false,
    notes: "DualShock 4 input profile exists, but no DualShock 4 PNG preset was found in input-overlay.",
};

pub const PROFILE_CATALOG: [ControllerProfile; 7] = [
    ControllerProfile {
        id: ProfileId::Xbox360,
        display_name: "Xbox 360 Controller",
        family: ControllerFamily::Xbox,
        preset_id: Some("xbox-controller"),
        match_kind: DeviceMatchKind::VendorProduct,
        input_map: STANDARD_MAP,
        transform: SIGNED_TRIGGER_TRANSFORM,
        calibration_status: CALIBRATED_WITH_INCLUDED_PRESET,
    },
    ControllerProfile {
        id: ProfileId::XboxOne,
        display_name: "Xbox One Controller",
        family: ControllerFamily::Xbox,
        preset_id: Some("xbox-one-controller"),
        match_kind: DeviceMatchKind::VendorProduct,
        input_map: STANDARD_MAP,
        transform: STANDARD_TRANSFORM,
        calibration_status: CALIBRATED_WITH_INCLUDED_PRESET,
    },
    ControllerProfile {
        id: ProfileId::XboxSeries,
        display_name: "Xbox Series Controller",
        family: ControllerFamily::Xbox,
        preset_id: Some("xbox-controller"),
        match_kind: DeviceMatchKind::VendorProduct,
        input_map: STANDARD_MAP,
        transform: STANDARD_TRANSFORM,
        calibration_status: CALIBRATED_WITH_INCLUDED_PRESET,
    },
    ControllerProfile {
        id: ProfileId::DualShock3,
        display_name: "DualShock 3",
        family: ControllerFamily::PlayStation,
        preset_id: Some("ds3"),
        match_kind: DeviceMatchKind::VendorProduct,
        input_map: STANDARD_MAP,
        transform: SIGNED_TRIGGER_TRANSFORM,
        calibration_status: CALIBRATED_WITH_INCLUDED_PRESET,
    },
    ControllerProfile {
        id: ProfileId::DualShock4,
        display_name: "DualShock 4",
        family: ControllerFamily::PlayStation,
        preset_id: None,
        match_kind: DeviceMatchKind::VendorProduct,
        input_map: DUALSHOCK4_MAP,
        transform: STANDARD_TRANSFORM,
        calibration_status: NEEDS_DS4_ASSET,
    },
    ControllerProfile {
        id: ProfileId::DualSense,
        display_name: "DualSense",
        family: ControllerFamily::PlayStation,
        preset_id: Some("dualsense"),
        match_kind: DeviceMatchKind::VendorProduct,
        input_map: DUALSENSE_MAP,
        transform: STANDARD_TRANSFORM,
        calibration_status: CALIBRATED_WITH_INCLUDED_PRESET,
    },
    ControllerProfile {
        id: ProfileId::GenericXInput,
        display_name: "Generic XInput-compatible Controller",
        family: ControllerFamily::XInput,
        preset_id: Some("xbox-controller"),
        match_kind: DeviceMatchKind::XInputName,
        input_map: STANDARD_MAP,
        transform: STANDARD_TRANSFORM,
        calibration_status: CALIBRATED_WITH_INCLUDED_PRESET,
    },
];

const VENDOR_PRODUCT_PROFILES: [VendorProductProfile; 15] = [
    VendorProductProfile {
        vendor_id: 0x045e,
        product_id: 0x028e,
        profile_id: ProfileId::Xbox360,
        input_map: STANDARD_MAP,
        transform: SIGNED_TRIGGER_TRANSFORM,
    },
    VendorProductProfile {
        vendor_id: 0x045e,
        product_id: 0x0719,
        profile_id: ProfileId::Xbox360,
        input_map: STANDARD_MAP,
        transform: SIGNED_TRIGGER_TRANSFORM,
    },
    VendorProductProfile {
        vendor_id: 0x045e,
        product_id: 0x02d1,
        profile_id: ProfileId::XboxOne,
        input_map: STANDARD_MAP,
        transform: STANDARD_TRANSFORM,
    },
    VendorProductProfile {
        vendor_id: 0x045e,
        product_id: 0x02dd,
        profile_id: ProfileId::XboxOne,
        input_map: STANDARD_MAP,
        transform: STANDARD_TRANSFORM,
    },
    VendorProductProfile {
        vendor_id: 0x045e,
        product_id: 0x02e3,
        profile_id: ProfileId::XboxOne,
        input_map: STANDARD_MAP,
        transform: STANDARD_TRANSFORM,
    },
    VendorProductProfile {
        vendor_id: 0x045e,
        product_id: 0x02ea,
        profile_id: ProfileId::XboxOne,
        input_map: STANDARD_MAP,
        transform: STANDARD_TRANSFORM,
    },
    VendorProductProfile {
        vendor_id: 0x045e,
        product_id: 0x02fd,
        profile_id: ProfileId::XboxOne,
        input_map: STANDARD_MAP,
        transform: STANDARD_TRANSFORM,
    },
    VendorProductProfile {
        vendor_id: 0x045e,
        product_id: 0x0b12,
        profile_id: ProfileId::XboxSeries,
        input_map: STANDARD_MAP,
        transform: STANDARD_TRANSFORM,
    },
    VendorProductProfile {
        vendor_id: 0x045e,
        product_id: 0x0b13,
        profile_id: ProfileId::XboxSeries,
        input_map: STANDARD_MAP,
        transform: STANDARD_TRANSFORM,
    },
    VendorProductProfile {
        vendor_id: 0x054c,
        product_id: 0x0268,
        profile_id: ProfileId::DualShock3,
        input_map: STANDARD_MAP,
        transform: SIGNED_TRIGGER_TRANSFORM,
    },
    VendorProductProfile {
        vendor_id: 0x054c,
        product_id: 0x05c4,
        profile_id: ProfileId::DualShock4,
        input_map: DUALSHOCK4_MAP,
        transform: STANDARD_TRANSFORM,
    },
    VendorProductProfile {
        vendor_id: 0x054c,
        product_id: 0x09cc,
        profile_id: ProfileId::DualShock4,
        input_map: DUALSHOCK4_MAP,
        transform: STANDARD_TRANSFORM,
    },
    VendorProductProfile {
        vendor_id: 0x054c,
        product_id: 0x0ba0,
        profile_id: ProfileId::DualShock4,
        input_map: DUALSHOCK4_MAP,
        transform: STANDARD_TRANSFORM,
    },
    VendorProductProfile {
        vendor_id: 0x054c,
        product_id: 0x0ce6,
        profile_id: ProfileId::DualSense,
        input_map: DUALSENSE_MAP,
        transform: STANDARD_TRANSFORM,
    },
    VendorProductProfile {
        vendor_id: 0x054c,
        product_id: 0x0df2,
        profile_id: ProfileId::DualSense,
        input_map: DUALSENSE_MAP,
        transform: STANDARD_TRANSFORM,
    },
];

pub fn profile_catalog() -> Vec<ProfileInfo> {
    PROFILE_CATALOG.iter().map(profile_info).collect()
}

pub fn match_profile(identity: &DeviceIdentity) -> Result<ControllerProfile, UnsupportedDevice> {
    if let (Some(vendor_id), Some(product_id)) = (identity.vendor_id, identity.product_id) {
        if let Some(profile) = match_vendor_product(vendor_id, product_id) {
            return Ok(profile);
        }
    }

    let normalized_name = identity.name.to_lowercase();
    if normalized_name.contains("xinput") {
        return profile_by_id(ProfileId::GenericXInput);
    }

    Err(UnsupportedDevice {
        reason: unsupported_reason(identity),
        identity: identity.clone(),
    })
}

pub fn profile_by_id(profile_id: ProfileId) -> Result<ControllerProfile, UnsupportedDevice> {
    PROFILE_CATALOG
        .iter()
        .find(|profile| profile.id == profile_id)
        .copied()
        .ok_or_else(|| UnsupportedDevice {
            reason: format!("Profile {} is not registered.", profile_id.as_str()),
            identity: DeviceIdentity {
                id: "profile-catalog".to_string(),
                name: profile_id.as_str().to_string(),
                vendor_id: None,
                product_id: None,
                uuid: String::new(),
            },
        })
}

pub fn profile_info(profile: &ControllerProfile) -> ProfileInfo {
    ProfileInfo {
        id: profile.id.as_str().to_string(),
        display_name: profile.display_name.to_string(),
        family: profile.family,
        preset_id: profile.preset_id.map(str::to_string),
        match_kind: profile.match_kind,
        calibration_status: profile.calibration_status,
    }
}

pub fn device_identity(id: impl ToString, gamepad: &Gamepad<'_>) -> DeviceIdentity {
    DeviceIdentity {
        id: id.to_string(),
        name: gamepad.name().to_string(),
        vendor_id: gamepad.vendor_id(),
        product_id: gamepad.product_id(),
        uuid: format_uuid(gamepad.uuid()),
    }
}

fn match_vendor_product(vendor_id: u16, product_id: u16) -> Option<ControllerProfile> {
    VENDOR_PRODUCT_PROFILES
        .iter()
        .find(|variant| variant.vendor_id == vendor_id && variant.product_id == product_id)
        .and_then(|variant| {
            let mut profile = profile_by_id(variant.profile_id).ok()?;
            profile.input_map = variant.input_map;
            profile.transform = variant.transform;
            Some(profile)
        })
}

fn unsupported_reason(identity: &DeviceIdentity) -> String {
    match (identity.vendor_id, identity.product_id) {
        (Some(vendor), Some(product)) => format!(
            "No explicit controller profile for vendor 0x{vendor:04x}, product 0x{product:04x}."
        ),
        _ => "No vendor/product ID was exposed and no explicit XInput name match was found."
            .to_string(),
    }
}

fn format_uuid(bytes: [u8; 16]) -> String {
    bytes
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<Vec<_>>()
        .join("")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn identity(vendor_id: Option<u16>, product_id: Option<u16>, name: &str) -> DeviceIdentity {
        DeviceIdentity {
            id: "0".to_string(),
            name: name.to_string(),
            vendor_id,
            product_id,
            uuid: "test".to_string(),
        }
    }

    #[test]
    fn matches_xbox_series_by_vendor_product() {
        let profile = match_profile(&identity(Some(0x045e), Some(0x0b12), "Controller")).unwrap();
        assert_eq!(profile.id, ProfileId::XboxSeries);
    }

    #[test]
    fn matches_dualsense_by_vendor_product() {
        let profile = match_profile(&identity(Some(0x054c), Some(0x0ce6), "Controller")).unwrap();
        assert_eq!(profile.id, ProfileId::DualSense);
        assert_eq!(
            profile
                .input_map
                .extra_buttons
                .misc1
                .map(|code| code.packed_gilrs_code),
            Some(14)
        );
        assert_eq!(
            profile
                .input_map
                .extra_buttons
                .touchpad
                .map(|code| code.packed_gilrs_code),
            Some(13)
        );
    }

    #[test]
    fn matches_dualshock4_touchpad_raw_button_code() {
        let profile = match_profile(&identity(Some(0x054c), Some(0x09cc), "Controller")).unwrap();
        assert_eq!(profile.id, ProfileId::DualShock4);
        assert_eq!(
            profile
                .input_map
                .extra_buttons
                .touchpad
                .map(|code| code.packed_gilrs_code),
            Some(13)
        );
        assert!(profile.input_map.extra_buttons.misc1.is_none());
    }

    #[test]
    fn matches_generic_xinput_by_name_only() {
        let profile = match_profile(&identity(None, None, "XInput Controller")).unwrap();
        assert_eq!(profile.id, ProfileId::GenericXInput);
    }

    #[test]
    fn unsupported_profile_is_explicit_error() {
        let error = match_profile(&identity(Some(0x1234), Some(0xabcd), "Unknown")).unwrap_err();
        assert!(error.reason.contains("0x1234"));
        assert!(error.reason.contains("0xabcd"));
    }
}
