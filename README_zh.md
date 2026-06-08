# controllerX

适用于 Xbox 和 PlayStation 手柄的透明桌面按键显示工具。

[English README](README.md)

controllerX 会在桌面上显示一个悬浮手柄图层。当你按下按键、移动摇杆或扣动扳机时，图层会同步变化。它适合录制游戏、直播展示、测试手柄输入，以及检查手柄是否被正确识别。

## 主要功能

- 透明、置顶的桌面悬浮窗口。
- 支持 Xbox 360、Xbox One、Xbox Series、DualShock 3、DualShock 4、DualSense，以及常见 XInput 兼容手柄。
- 托盘菜单支持显示/隐藏、鼠标穿透、锁定位置、快速调整尺寸和退出。
- 自动保存透明度、缩放、窗口位置、死区、灵敏度、轴反转等设置。
- 在 Windows 上，即使窗口失去焦点或开启鼠标穿透，手柄状态也可以继续更新。
- 遇到不支持的手柄或缺少图像资源时，会显示明确提示。
- 提供模拟模式、调试面板和硬件验证工具，方便开发和测试。

## 环境要求

- 当前桌面悬浮窗流程主要面向 Windows。
- Node.js 和 npm。
- Rust 和 Cargo。
- 已安装 Tauri 2 所需的系统依赖。

## 本地运行

安装依赖：

```powershell
npm install
```

启动桌面应用：

```powershell
npm run tauri:dev
```

## 检查项目

运行前端检查：

```powershell
npm run check
npm run test
npm run build
```

运行 Rust 检查：

```powershell
Push-Location src-tauri
cargo fmt -- --check
cargo test
Pop-Location
```

也可以运行项目验证脚本：

```powershell
.\scripts\verify-project.ps1
```

## 构建安装包

构建未签名的 Windows 安装包：

```powershell
npm run tauri:build
```

常见输出位置：

- `src-tauri/target/release/bundle/nsis/controllerX_0.1.0_x64-setup.exe`
- `src-tauri/target/release/bundle/msi/controllerX_0.1.0_x64_en-US.msi`

## 素材说明

手柄图片和预设文件位于 `public/vendor/input-overlay`。
素材来源和许可说明见 `third_party/input-overlay/NOTICE.md`。
