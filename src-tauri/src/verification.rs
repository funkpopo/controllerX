use std::fs;
use std::path::Path;

use serde::Serialize;
use tauri::Manager;

const REPORT_DIR: &str = "verification-reports";
const REPORT_TITLE: &str = "# Hardware Verification Report";
const MAX_FILE_NAME_LEN: usize = 140;
const MAX_REPORT_BYTES: usize = 256 * 1024;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedHardwareVerificationReport {
    pub path: String,
}

pub fn save_hardware_report(
    app: &tauri::AppHandle,
    file_name: &str,
    content: &str,
) -> Result<SavedHardwareVerificationReport, String> {
    validate_report_file_name(file_name)?;
    validate_report_content(content)?;

    let report_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?
        .join(REPORT_DIR);

    fs::create_dir_all(&report_dir)
        .map_err(|error| format!("Failed to create report directory: {error}"))?;

    let report_path = report_dir.join(file_name);
    fs::write(&report_path, content)
        .map_err(|error| format!("Failed to write report {}: {error}", report_path.display()))?;

    Ok(SavedHardwareVerificationReport {
        path: report_path.display().to_string(),
    })
}

fn validate_report_content(content: &str) -> Result<(), String> {
    if content.trim().is_empty() {
        return Err("Hardware verification report content is empty.".to_string());
    }

    if content.len() > MAX_REPORT_BYTES {
        return Err(format!(
            "Hardware verification report is too large: {} bytes.",
            content.len()
        ));
    }

    if !content.starts_with(REPORT_TITLE) {
        return Err(format!(
            "Hardware verification report must start with '{REPORT_TITLE}'."
        ));
    }

    Ok(())
}

fn validate_report_file_name(file_name: &str) -> Result<(), String> {
    if file_name.is_empty() {
        return Err("Report file name is empty.".to_string());
    }

    if file_name.len() > MAX_FILE_NAME_LEN {
        return Err(format!(
            "Report file name is too long: {} characters.",
            file_name.len()
        ));
    }

    if !file_name.ends_with(".md") {
        return Err("Report file name must end with .md.".to_string());
    }

    if file_name.contains("..") {
        return Err("Report file name must not contain '..'.".to_string());
    }

    if Path::new(file_name).components().count() != 1 {
        return Err("Report file name must not contain path separators.".to_string());
    }

    if !file_name
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.'))
    {
        return Err(
            "Report file name may contain only ASCII letters, digits, '-', '_', and '.'."
                .to_string(),
        );
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn report_file_name_accepts_safe_markdown_names() {
        assert!(
            validate_report_file_name("20260607-120000-dualsense-usb-054c-0ce6-dualsense.md")
                .is_ok()
        );
    }

    #[test]
    fn report_file_name_rejects_paths() {
        assert!(validate_report_file_name("..\\report.md").is_err());
        assert!(validate_report_file_name("../report.md").is_err());
        assert!(validate_report_file_name("report.txt").is_err());
        assert!(validate_report_file_name("report name.md").is_err());
    }

    #[test]
    fn report_content_must_be_hardware_report() {
        assert!(validate_report_content("# Hardware Verification Report\n\nbody").is_ok());
        assert!(validate_report_content("# Other\n\nbody").is_err());
        assert!(validate_report_content("").is_err());
    }
}
