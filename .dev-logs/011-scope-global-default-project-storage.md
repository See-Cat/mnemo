# 011 - scope 默认改为 global + project 真正隔离存储

## 背景

之前 `memory_setup` 的 `scope` 参数只有提示词注入语义：

- `project` 只是把 prompt 写到当前 `cwd` 下的 `AGENTS.md` / `CLAUDE.md`
- `global` 只是把 prompt 写到用户级 agent 配置

但所有记忆数据始终共用同一套全局目录，导致 `scope=project` 这个名字会误导用户，以为它代表项目级记忆隔离。

用户希望把默认值改成 `global`，因为跨项目共享记忆是 mnemo 的核心定位；同时也认可 `project` 模式应该提供真正的项目隔离。

## 设计决策

### 1. `scope` 默认值改为 `global`

理由：默认行为要和产品定位一致。Mnemo 默认应该是“个人级共享记忆系统”，而不是“当前目录里的局部工具”。

### 2. `project` 不再只是 prompt 安装位置，而是完整的项目级存储作用域

`memory_setup(scope='project')` 现在会同时做两件事：

- 将 prompt 写入项目级 agent 配置文件
- 在项目根目录创建 `.mnemo/`，使后续所有记忆读写都落到该项目内

### 3. 引入初始化 marker，运行时自动解析存储上下文

新增两类 marker：

- 全局：`<globalDataDir>/config.json`
- 项目：`<projectRoot>/.mnemo/config.json`

所有 memory tool 在执行时统一按这个顺序解析：

1. 从当前 `cwd` 向上查找项目 marker
2. 找不到再检查全局 marker
3. 两者都没有则报错，要求先运行 `memory_setup`

这样避免了“包已经安装，但当前环境其实没初始化”时的语义混乱。

### 4. `memory_setup` 新增 `project_root`

当 `scope='project'` 时，支持显式指定项目根目录；否则自动按以下优先级解析：

1. `project_root`
2. git root
3. 向上查找项目标记（`.git` / `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod`）
4. 最后退回当前 `cwd`

## 代码改动

### `src/core/config.ts`

- 新增 `StorageScope`、`StorageContext`
- 新增全局/项目 config 路径函数
- 新增 `writeStorageConfig()`
- 新增 `findProjectConfig()`
- 新增 `resolveStorageContext()`，统一解析当前读写位置

### `src/core/notes.ts`

- 不再直接读取固定全局 `notes/`
- 改为每次通过 `resolveStorageContext()` 动态决定 `notesDir`

### `src/core/embedding.ts`

- 不再使用单例 index 路径
- 改为按 `indexDir` 维护 `LocalIndex` 实例 Map
- 从而支持 global / project 多套索引并存

### `src/tools/setup.ts`

- `scope` 默认值从 `project` 改为 `global`
- 新增 `project_root`
- 新增项目根自动解析逻辑
- 初始化时写入 storage marker
- 返回信息中明确区分 `Prompt scope` / `Prompt file` / `Storage scope` / `Storage path`

### 文档

- README 与中文文档都补充了新的 scope 语义
- 明确说明：使用其他 memory tool 前必须先运行 `memory_setup`

### `src/prompts/templates.ts`

- 补充 `memory_setup` 的触发时机
- 明确“未初始化时报错时，应先调用 `memory_setup`”
- 明确默认选择 `global`
- 明确仅当用户显式要求项目隔离时才使用 `project`

## 测试补充

- config 测试新增：全局 marker、项目 marker、存储解析优先级、未初始化报错
- tools 测试新增：默认 global、project marker 创建、`project_root` 优先级
- templates 测试新增：初始化兜底与默认 global 策略断言
- notes / embedding 测试补充全局初始化步骤，匹配新语义

## 结果

这次改动把 `scope` 从“只影响 prompt 写入位置”的伪语义，收敛成了“同时决定初始化方式与后续存储作用域”的真实语义。

最终行为更符合 Mnemo 的定位：

- 默认全局共享
- 需要时显式项目隔离
- 未初始化时明确报错，而不是偷偷回退到某个隐式目录
