# Munich SZE Notfall Termin Helper

一个给慕尼黑 **Servicestelle für Zuwanderung und Einbürgerung (SZE)** Notfalltermin 页面使用的 Tampermonkey 辅助脚本。

它不会绕过 `Ich bin kein Bot` / CAPTCHA，也不会自动提交最终预约。你需要自己完成验证码；脚本只在验证码通过后帮助更快地点击可预约日期、时间段和 `Weiter`。

## 请选择你的版本

### 1. Studierende / Arbeitsplatzsuche nach Studium

预约入口：  
https://stadt.muenchen.de/buergerservice/terminvereinbarung.html#/services/10339027/locations/10187259

脚本：  
[`scripts/munich-sze-student-quick-booker.user.js`](scripts/munich-sze-student-quick-booker.user.js)

中文教程：  
[`docs/student.md`](docs/student.md)

### 2. Beschäftigte / Angehörige

预约入口：  
https://stadt.muenchen.de/buergerservice/terminvereinbarung.html#/services/10339028/locations/10461

脚本：  
[`scripts/munich-sze-beschaeftigte-angehoerige-quick-booker.user.js`](scripts/munich-sze-beschaeftigte-angehoerige-quick-booker.user.js)

中文教程：  
[`docs/beschaeftigte-angehoerige.md`](docs/beschaeftigte-angehoerige.md)

## 快速开始

1. Chrome 安装 [Tampermonkey](https://www.tampermonkey.net/)。
2. 在 Chrome 扩展详情里开启 **Allow User Scripts / 允许用户脚本**。
3. Tampermonkey → **Create a new script**。
4. 根据你的身份选择上面的学生版或 Beschäftigte / Angehörige 版 `.user.js`，把代码全部复制进去并保存。
5. 打开对应预约页面，确认右下角出现 Quick Booker 面板，状态为 `AUTO: ON`。
6. 手动完成 `Ich bin kein Bot`。后续脚本会帮助快速选择日期和时间。

![Tampermonkey extension](images/tampermonkey-extension.svg)

![Enabled userscripts](images/tampermonkey-scripts.svg)

![Appointment page](images/appointment-page.svg)

## 官网放号时间（截至 2026-09-24）

### 学生类

- 周一、周三、周五：**06:30**
- 周二、周四：**07:30**
- 官网说明是当天的短期 Notfalltermine

官方说明：  
https://stadt.muenchen.de/service/info/servicestelle-fur-zuwanderung-und-einburgerung/10338844/

### Beschäftigte / Angehörige

- 周一到周五，**上午和中午各放一次**
- 大约在相应 Öffnungszeiten 开始前 **10 分钟**放出
- 下一周的号也会在一周内陆续进入系统

官方说明：  
https://stadt.muenchen.de/service/info/servicestelle-fur-zuwanderung-und-einburgerung/10339026/

## 重要说明

- 只应用于符合 SZE 官方 **Notfall** 条件并正常预约的情况。
- CAPTCHA 必须由用户本人完成。
- 脚本不直接调用 SZE 后台预约接口，也不会高频刷新服务器。
- `100 ms` 的扫描仅检查浏览器中已经加载出来的 DOM。
- 进入 `Kontakt` 页面后停止自动操作，最终信息和提交由用户本人完成。
- 网站结构改变后脚本可能需要更新。
- 不保证一定能抢到 Termin。

## Disclaimer

This is an unofficial community helper and is not affiliated with the City of Munich. Use it responsibly and follow the official SZE rules and eligibility requirements.
