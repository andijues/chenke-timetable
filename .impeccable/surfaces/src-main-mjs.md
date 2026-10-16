---
version: 1
slug: "src-main-mjs"
primary_target: "src/main.mjs"
related_targets: ["public/style.css","index.html"]
---

# 今日课表与明日起床

Mode: Operate。用户要求替换旧界面；首页选择“今天课程为主，突出下一节课和明日起床”。沿用直接实现并预览、code 构建偏好。保留 Android 与鸿蒙，所有真实课表留在本机。

## Direction contract

THESIS: 用今天的课程顺序回答“下一节去哪”，用明日的第一节晨课回答“几点起床”；整周课表为次级视图。

OWN-WORLD: 图书馆馆藏索引的明确分组、编号日期和整齐行列，转译为蓝白色手机课务界面；钴蓝选择态、深墨阅读、浅蓝灰背景，明日起床用克制的浅黄色功能区。系统中文无衬线与等宽数字，大触点；不用模拟纸纹、装饰编号或老松绿色。

STORY: 打开后先看下一节课程与地点，再看明早起床和真实系统状态；按七日日期条切换日程，点课程修改，按需切换周视图。确认课程并开启一次自动安排后，应用在前台为明日发送免确认时钟请求；未支持、未确认或日期不安全时说明原因。

FIRST VIEWPORT: 390×844 手机上顶栏收紧，日期与学期周位于标题，七日日期条在其下。下一节课为首要信息，明日起床时间紧接其后；今日课程时间列表作为主内容，底部四项导航。桌面用侧边导航、宽时间列表和右侧明日计划，不把手机版拉宽。主要操作在顶部添加和下方直接可点的课程行。

FORM: 候选顺序：图书馆自助终端、晨跑分段计时屏、教室门牌导览、排练日程、校园活动手册、馆藏索引、实验室预约终端。采用第6项，seed c7a173a8；网络重试仍无挑战者及 quality-bar 参考图，明确按已授权 code 路径执行。日期切换为签名交互，选中态与课程列表即时对应；状态过渡160ms，减少动效时关闭。系统时钟没有保存回执，不虚构“已设置成功”。

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

验证以共享界面的 Windows 浏览器截图与行为为限；另编译 Android/Harmony 工程，不把网页截图或模拟桥接当作真机响铃证明。保留所有原课表解析回归。
