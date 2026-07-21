
## 项目概要

- 采用卡片的交互方式显示英文单词。并能提供几个选项来选择。
- 可以选择单词的主题:
    - 动词的第三人称单数，ing形式，过去式。
    - 名词的复数形式
- 需要判断对错，并据艾宾浩斯记忆曲线更新内容的熟练度
    
## 项目结构

/flash-cards
│
├── src/
│   ├── index.html       # 前端核心页面
│   └── data/
│       └── words.js     # 词库配置文件
├── README.md            # 项目说明
│
└── /api                 # 后端管理文件夹（Azure SWA 会自动将其识别为 Serverless 函数）
    ├── package.json    # 后端依赖配置（声明安装 @azure/cosmos 驱动）
    │
    ├── /GetProgress    # 获取进度的 API 函数
    │   ├── index.js    # 函数逻辑代码
    │   └── function.json
    │
    └── /UpdateProgress # 更新进度的 API 函数
        ├── index.js    # 函数逻辑代码
        └── function.json

## 技术栈

- 基于HTML/JS 纯原

## 部署方式

- 前端静态托管：Azure Static Web Apps (SWA)
- 后端 API：Azure Functions (Serverless) —— 每个月前 100 万次调用免费
- 数据库：Azure Cosmos DB (NoSQL) —— 免费层

