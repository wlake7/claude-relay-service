# 费用乘数系数 (Cost Multiplier) 使用说明

## 概述

`costMultiplier` 是一个数据缩放系数，允许您同时调整用户侧看到的**费用和Tokens数量**，同时保持**费用/Tokens比例不变**（即单价不变）。

## 核心特性

⭐ **费用和Tokens同步缩放**
- 设置 `COST_MULTIPLIER=1.2`
- 费用：$0.001 → $0.0012（120%）
- Tokens：1000 → 1200（120%）
- 单价：$0.001/1000 = $0.0012/1200（保持不变）

⭐ **后端账户管理不受影响**
- Claude账户的5小时/7天窗口限制基于OAuth API
- 账户调度策略基于真实数据
- 轮询逻辑不受缩放影响

## 配置方式

在 `.env` 文件中设置：

```bash
COST_MULTIPLIER=1.2  # 费用增加20%
```

或在 `config/config.example.js` 中配置：

```javascript
billing: {
  costMultiplier: 1.2
}
```

## 系统架构设计

系统内部维护**两套费用计算方法**：

### 1. `calculateCost()` - 应用乘数系数

**用途**：用户侧展示和限制判断

**调用位置**：
- ✅ 前端界面显示（Dashboard、API Key管理、使用统计等）
- ✅ API统计接口返回数据
- ✅ API Key费用限制判断（每日限制、总费用限制、时间窗口限制）
- ✅ 计费事件和Webhook通知
- ✅ 用户查询使用情况的所有接口

**实现文件**：
- `src/services/pricingService.js` - `calculateCost(usage, modelName)`
- `src/utils/costCalculator.js` - `calculateCost(usage, model)`

### 2. `calculateRawCost()` - 原始费用（不应用乘数）

**用途**：后端账户管理和调度

**调用位置**：
- ❌ Claude OAuth账户的窗口限制判断（5小时、7天窗口）
- ❌ 账户调度和轮询逻辑
- ❌ 账户池的账户选择策略
- ❌ 后端内部的账户使用率计算

**实现文件**：
- `src/services/pricingService.js` - `calculateRawCost(usage, modelName)`
- `src/utils/costCalculator.js` - `calculateRawCost(usage, model)`

**注意**：Claude账户的5小时/7天窗口使用率数据直接来自Claude OAuth API，与我们的费用计算无关，因此本就不受costMultiplier影响。

## 使用场景

### 场景1：加价策略
```bash
COST_MULTIPLIER=1.2
```
- 用户看到：费用 $0.001 × 1.2 = $0.0012，Tokens 1000 × 1.2 = 1200
- 单价保持：$0.001/1000 = $0.0012/1200 = $0.000001/token
- API Key限制：按缩放后的数据判断，但费用/tokens比例不变

### 场景2：折扣策略
```bash
COST_MULTIPLIER=0.8
```
- 用户看到：费用和Tokens都打8折
- 单价保持：费用/Tokens比例不变
- 适合促销活动或特定用户群体

### 场景3：原始数据（默认）
```bash
COST_MULTIPLIER=1.0
```
- 不做任何调整，显示真实费用和Tokens

## 数据流示例

假设用户发起一次API请求，真实数据为：**费用 $0.001，Tokens 1000**，`COST_MULTIPLIER=1.2`：

### 前端用户侧（应用乘数）

```javascript
// 1. API请求完成，计算费用和Tokens
const result = pricingService.calculateCost(usage, model)
// result.totalCost = 0.001 * 1.2 = 0.0012
// result.totalTokens = 1000 * 1.2 = 1200
// 单价 = 0.0012 / 1200 = 0.000001（保持不变）

// 2. 记录到API Key统计
await apiKeyService.recordUsage(keyId, result.inputTokens, result.outputTokens, ...)
// Redis中存储: cost=0.0012, tokens=1200

// 3. 前端查询使用情况
GET /api/stats/key/usage?apiId=xxx
// 返回: { cost: 0.0012, tokens: 1200 }

// 4. 检查API Key每日费用限制
if (dailyCost >= dailyCostLimit) {
  // dailyCost = 0.0012，与用户设置的限制比较
  // 但费用/tokens比例保持不变
}
```

## 数据存储和聚合机制 🔑

### 存储层设计

**Redis存储的是已缩放数据**：
```javascript
// API响应: inputTokens=1000, outputTokens=2000 (原始)
// ↓ calculateCost() 应用 costMultiplier=1.2
// ↓ 存储到 Redis: inputTokens=1200, outputTokens=2400 (已缩放)
await redis.incrementTokenUsage(keyId, 1200, 2400, ...)
```

### 聚合计算的关键原则

⚠️ **重要**：从Redis读取数据进行聚合统计时，必须使用 `calculateRawCost()` 而不是 `calculateCost()`

**原因**：
- Redis 中的 tokens **已经被缩放过**（例如 1000 → 1200）
- 如果再次调用 `calculateCost()`，会**二次应用** multiplier
- 导致费用被放大：原始费用 × 1.2 × 1.2 = 1.44倍 ❌
- 而 tokens 只缩放了一次：1.2倍
- 结果：**费用/tokens 比率被放大**，违反"单价不变"的设计目标

**正确做法**：
```javascript
// ❌ 错误：二次缩放
const stats = await redis.getUsageStats(keyId)
// stats.inputTokens = 1200 (已缩放)
const cost = CostCalculator.calculateCost(usage, model)
// cost = 原始单价 × 1200 × 1.2 = 二次缩放 ❌

// ✅ 正确：使用 calculateRawCost()
const stats = await redis.getUsageStats(keyId)
// stats.inputTokens = 1200 (已缩放)
const cost = CostCalculator.calculateRawCost(usage, model)
// cost = 原始单价 × 1200 = 已缩放费用 ✅
```

**数学验证**：
```
假设：原始 inputTokens=1000, 单价=$0.000003, multiplier=1.2

存储时：
- 缩放后 tokens = 1000 × 1.2 = 1200
- 缩放后费用 = $0.000003 × 1000 × 1.2 = $0.0036

聚合时应得到：
- 方法1 (calculateRawCost): 1200 × $0.000003 = $0.0036 ✅
- 方法2 (calculateCost错误): 1200 × $0.000003 × 1.2 = $0.00432 ❌
```

### 代码应用位置

**需要使用 `calculateRawCost()` 的地方**：
- `src/routes/apiStats.js`: 所有聚合统计（按模型、按时间）
- `src/routes/admin.js`: 管理员后台的费用统计
- `src/models/redis.js`: `getAccountDailyCost()` 等费用聚合方法

**需要使用 `calculateCost()` 的地方**（从API响应直接计算）：
- `src/services/apiKeyService.js`: `recordUsageWithDetails()` 记录单次使用
- `src/services/*RelayService.js`: 处理API响应时的费用计算
- `src/utils/rateLimitHelper.js`: 速率限制相关的费用计算

## 使用场景示例

### 前端展示侧（应用乘数）

```javascript
// 1. API请求完成，计算费用和Tokens
const result = pricingService.calculateCost(usage, model)
// result.totalCost = 0.001 * 1.2 = 0.0012
// result.totalTokens = 1000 * 1.2 = 1200
// 单价 = 0.0012 / 1200 = 0.000001（保持不变）

// 2. 记录到API Key统计
await apiKeyService.recordUsage(keyId, result.inputTokens, result.outputTokens, ...)
// Redis中存储: cost=0.0012, tokens=1200

// 3. 前端查询使用情况
GET /api/stats/key/usage?apiId=xxx
// 从Redis读取已缩放数据，使用 calculateRawCost() 聚合
// 返回: { cost: 0.0012, tokens: 1200 }

// 4. 检查API Key每日费用限制
if (dailyCost >= dailyCostLimit) {
  // dailyCost = 0.0012，与用户设置的限制比较
  // 但费用/tokens比例保持不变
}
```
  return this._calculateCostInternal(usage, modelName, true)
}

// 内部实现
_calculateCostInternal(usage, modelName, applyMultiplier = true) {
  // ... 计算基础费用 ...
  
  if (applyMultiplier) {
    // 应用乘数系数
    finalCost = baseCost * this.getCostMultiplier()
  } else {
    // 不应用乘数
    finalCost = baseCost
  }
  
  return { totalCost: finalCost, ... }
}
```

#### costCalculator.js

同样的模式：
- `calculateRawCost()` - 不应用乘数
- `calculateCost()` - 应用乘数
- `_calculateCostInternal()` - 内部实现

### 返回数据标记

费用计算结果中包含调试信息：

```javascript
{
  totalCost: 0.0012,
  costMultiplier: 1.2,
  isMultiplierApplied: true,  // 标记是否应用了乘数
  // ...
}
```

## 注意事项

### ⚠️ 重要提醒

1. **费用限制配置要考虑乘数**
   - 如果设置 `COST_MULTIPLIER=1.2`
   - 用户设置每日限制为 $10
   - 实际达到限制时，真实消耗约为 $8.33

2. **历史数据不会自动调整**
   - 修改乘数系数后，已记录的费用不会自动重新计算
   - 仅影响新的请求

3. **计费事件和通知**
   - Webhook通知中的费用已应用乘数
   - 第三方系统接收到的费用是调整后的费用

4. **账户调度不受影响**
   - 无论如何调整乘数系数，后端账户的调度逻辑保持不变
   - Claude账户的窗口限制基于OAuth API的utilization，与我们的计费无关

## 验证方法

### 1. 验证前端显示

访问前端Dashboard，查看费用和Tokens显示：
```
真实费用 × COST_MULTIPLIER = 显示费用
真实Tokens × COST_MULTIPLIER = 显示Tokens
费用/Tokens比例保持不变
```

### 2. 验证API Key限制

设置测试API Key的每日限制，触发限制：
```bash
# 设置 COST_MULTIPLIER=2.0
# API Key每日限制: $1.00
# 当真实消耗达到 $0.50（1000 tokens）时
# 显示为 $1.00（2000 tokens），触发限制
# 但费用/tokens比例保持不变
```

### 3. 验证账户调度

修改乘数系数后，观察账户调度行为：
```bash
# 修改前后，账户的调度策略应该保持一致
# 5小时/7天窗口的限制判断不应该改变
# 因为这些基于OAuth API的utilization数据
```

### 4. 验证费用/Tokens比例

```bash
# 无论乘数是多少，费用/tokens比例应保持不变
# COST_MULTIPLIER=1.0: $0.001/1000 = 0.000001
# COST_MULTIPLIER=1.2: $0.0012/1200 = 0.000001
# COST_MULTIPLIER=0.8: $0.0008/800 = 0.000001
```

## 常见问题

### Q1: 修改乘数系数后，历史数据会变化吗？

**A**: 不会。已经记录的数据不会重新计算。只有新的请求会使用新的乘数系数。

### Q2: 乘数系数会影响账户调度吗？

**A**: 不会。账户调度基于Claude OAuth API返回的utilization数据，与我们的费用/Tokens计算完全独立。

### Q3: 可以为不同用户设置不同的乘数吗？

**A**: 当前版本不支持。乘数系数是全局配置。如需实现用户级差异化定价，需要进一步开发。

### Q4: Tokens数量会变化吗？

**A**: 会的！Tokens数量会按照与费用相同的系数缩放，保持费用/Tokens的比例不变（即单价不变）。

### Q5: 为什么要同时缩放费用和Tokens？

**A**: 这样可以保持单价不变，用户看到的仍然是相同的价格结构，只是数据规模发生了变化。例如：
- 原始：$0.001 / 1000 tokens = $0.000001/token
- 1.2倍：$0.0012 / 1200 tokens = $0.000001/token（单价相同）

这样用户无法察觉到价格策略的改变，体验更加一致。

## 总结

费用乘数系数功能实现了**用户侧数据展示**与**后端账户管理**的解耦：

- ✅ **用户侧**：费用和Tokens同步缩放，单价保持不变
- ✅ **后端侧**：保持基于真实数据的账户管理逻辑不变
- ✅ **完全透明**：用户看到一致的单价结构，无法察觉系统差异
- ✅ **灵活运营**：可以根据业务需要调整展示数据规模

这种设计既满足了灵活定价的业务需求，又保证了系统稳定性和用户体验一致性。
