# 费用乘数系数 (Cost Multiplier) - 快速参考

## 一句话说明
`costMultiplier` 让你同时调整用户看到的**费用和Tokens**，保持**单价不变**，但**不影响**后端账户调度。

## 核心特性

⭐ **费用和Tokens同步缩放**
- 费用 × 系数
- Tokens × 系数  
- 单价保持不变

⭐ **后端逻辑不受影响**
- 账户调度基于OAuth API
- 窗口限制不受影响

## 配置示例

```bash
# .env
COST_MULTIPLIER=1.2  # 费用显示为真实价格的120%
```

## 影响范围速查表

| 功能模块 | 是否受影响 | 说明 |
|---------|-----------|------|
| **用户侧** | | |
| 前端Dashboard费用显示 | ✅ 影响 | 显示乘数后的费用 |
| API统计接口 | ✅ 影响 | 返回乘数后的费用 |
| API Key每日费用限制 | ✅ 影响 | 用乘数后费用判断 |
| API Key总费用限制 | ✅ 影响 | 用乘数后费用判断 |
| API Key窗口费用限制 | ✅ 影响 | 用乘数后费用判断 |
| Opus周费用限制 | ✅ 影响 | 用乘数后费用判断 |
| Webhook计费通知 | ✅ 影响 | 通知乘数后费用 |
| 使用记录查询 | ✅ 影响 | 显示乘数后费用 |
| **后端管理** | | |
| Claude账户5小时窗口 | ❌ 不影响 | 基于OAuth API的utilization |
| Claude账户7天窗口 | ❌ 不影响 | 基于OAuth API的utilization |
| 账户调度策略 | ❌ 不影响 | 基于账户状态和OAuth数据 |
| 账户轮询逻辑 | ❌ 不影响 | 基于schedulable等状态 |
| 账户池选择 | ❌ 不影响 | 基于优先级和可用性 |
| **数据** | | |
| Tokens数量 | ✅ 影响 | Tokens按相同系数缩放 |
| 请求次数 | ❌ 不影响 | 请求计数不受影响 |
| 费用/Token比例 | ❌ 不影响 | 单价保持不变 |

## 使用场景

### 📈 加价 20%
```bash
COST_MULTIPLIER=1.2
```
- 真实：$1.00 / 1000 tokens → 用户看到：$1.20 / 1200 tokens
- 单价保持：$0.001/token（不变）
- API Key限制 $10 → 实际真实消耗约 $8.33 时触发

### 📉 折扣 20%
```bash
COST_MULTIPLIER=0.8
```
- 真实：$1.00 / 1000 tokens → 用户看到：$0.80 / 800 tokens
- 单价保持：$0.001/token（不变）
- API Key限制 $10 → 实际真实消耗 $12.50 时触发

### 🔄 原始数据
```bash
COST_MULTIPLIER=1.0
```
- 默认值，不做任何调整

## 核心API

### JavaScript/Node.js

```javascript
const pricingService = require('./services/pricingService')

// 前端显示/用户限制 - 应用乘数
const displayCost = pricingService.calculateCost(usage, model)
// displayCost.totalCost = 真实费用 × costMultiplier

// 后端管理/账户调度 - 不应用乘数
const rawCost = pricingService.calculateRawCost(usage, model)
// rawCost.totalCost = 真实费用（原价）
```

### 数据流示例

```
API请求 
  ↓
计算费用和Tokens
  ├─→ calculateCost()      → $0.0012 & 1200 tokens (1.2倍) → 用户看到的数据
  └─→ calculateRawCost()   → $0.0010 & 1000 tokens (原始)  → 账户管理用数据
  ↓
记录使用
  └─→ Redis存储: $0.0012 & 1200 tokens (应用乘数后)
  ↓
前端查询
  ↓
显示: $0.0012 / 1200 tokens
单价: $0.000001/token（与真实单价相同）
```

## 关键点

✅ **DO（要做的）**
- 用于调整用户侧数据展示规模
- 理解费用和Tokens同步缩放
- 知道单价保持不变

❌ **DON'T（不要做的）**
- 不要期望修改乘数会影响账户调度
- 不要认为历史数据会自动调整
- 不要忘记费用和Tokens是联动的

## 验证检查清单

- [ ] 前端费用 = 真实费用 × 乘数 ✓
- [ ] 前端Tokens = 真实Tokens × 乘数 ✓
- [ ] 费用/Tokens比例保持不变 ✓
- [ ] API Key限制按缩放后数据触发 ✓
- [ ] 账户调度行为不变 ✓
- [ ] Claude账户窗口限制不变 ✓

## 更多信息

详细说明请参考：[COST_MULTIPLIER.md](./COST_MULTIPLIER.md)
