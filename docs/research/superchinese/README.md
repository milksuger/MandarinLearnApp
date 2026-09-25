# SuperChinese 产品调研汇报

**调研日期：** 2026-09-25
**范围：** SuperChinese 的移动端信息架构、主要页面跳转、课程组织方式，以及对 MandarinLearnApp 的参考点。

## 结论摘要

SuperChinese 的产品主轴是一个按级别推进的 **Main Course 主课程**：先用可选拼音课或水平测试确定起点，再按真实生活场景学习。一个单元先教场景所需词汇和语法，再进入对话、故事或主题课，最后做理解、复习和口语输出。发音练习从第一课开始，系统把发音反馈标到具体汉字。

主课程之外，官方 FAQ 还区分了 **Practice（情景口语练习）、Discover（主题/词汇等扩展内容）、Talk（学习者社区）和 Profile（个人资料与设置）**。近期商店更新又加入 Review Center，提供智能复习、按内容类型筛选复习及多技能练习；该功能正在分批开放，用户看到的界面可能不同。

可借鉴的产品方法是：主路径负责连续学习，练习和扩展内容各自独立；每节课沿用稳定的学习节奏；把反馈直接连接到具体错误；让水平测试、拼音先修和继续学习入口减少“下一步学什么”的决策负担。

## 报告导航

- [01｜界面结构与跳转](./01-interface-and-navigation.md)：页面职责、入口流转、可观察的布局层级和证据边界。
- [02｜课程安排与产品启示](./02-curriculum-and-product-notes.md)：级别与单元结构、单元教学顺序、复习与付费分层，以及对本项目的参考建议。

## 关键口径与证据边界

官方 FAQ 与官网目前称 Main Course 有 **8 个级别、每级 24 个单元，覆盖 HSK 1–5**，另称课程超过 1,000 个短课；Google Play 和 Apple App Store 的商店介绍仍写着 **9 个级别、400 多课**。这些数字可能采用了不同统计范围或文案版本，但公开资料没有解释差异，因此本报告按来源分别记录，不把它们拼成单一确定数字。

报告依据截至调研日可访问的官网 FAQ/产品页、Google Play 与 Apple App Store 产品页和更新记录。未登录应用内账户，也未逐屏操作当前 Android/iOS 版本。因此，功能和内容顺序以官方说明为依据；涉及具体页面组件、视觉样式或跳转细节时，会标为公开信息重建或待实机验证，不推测颜色、字号和按钮位置。

## 主要来源

- [SuperChinese 官方 FAQ](https://www.superchinese.com/faq.html)：主课程、四个内容区、口语反馈、课程顺序、设置路径和免费/付费边界。
- [SuperChinese 官方首页](https://www.superchinese.com/)：八级路径、场景主题、课程示例和官网呈现的学习路径预览。
- [SuperChinese 官方功能介绍](https://www.superchinese.com/features.html)：场景学习、水平测试、口语、游戏化及智能复习的产品定位。
- [Google Play 产品页](https://play.google.com/store/apps/details?id=com.superchinese&hl=en_US)：商店描述、课程数量口径、最近更新时间和 Review Center 更新。
- [Apple App Store 产品页与版本记录](https://apps.apple.com/us/app/superchinese-learn-chinese/id1462500984)：iPhone/iPad 支持、近期版本变更、练习区改版与 Review Center 分批开放说明。
