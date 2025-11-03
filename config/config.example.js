const path = require('path')
require('dotenv').config()

const config = {
  // 🌐 服务器配置
  server: {
    port: parseInt(process.env.PORT) || 3000,
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
    trustProxy: process.env.TRUST_PROXY === 'true'
  },

  // 🔐 安全配置
  security: {
    jwtSecret: process.env.JWT_SECRET || 'CHANGE-THIS-JWT-SECRET-IN-PRODUCTION',
    adminSessionTimeout: parseInt(process.env.ADMIN_SESSION_TIMEOUT) || 86400000, // 24小时
    apiKeyPrefix: process.env.API_KEY_PREFIX || 'cr_',
    encryptionKey: process.env.ENCRYPTION_KEY || 'CHANGE-THIS-32-CHARACTER-KEY-NOW'
  },

  // 📊 Redis配置
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB) || 0,
    connectTimeout: 10000,
    commandTimeout: 5000,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableTLS: process.env.REDIS_ENABLE_TLS === 'true'
  },

  // 🔗 会话管理配置
  session: {
    // 粘性会话TTL配置（小时），默认1小时
    stickyTtlHours: parseFloat(process.env.STICKY_SESSION_TTL_HOURS) || 1,
    // 续期阈值（分钟），默认0分钟（不续期）
    renewalThresholdMinutes: parseInt(process.env.STICKY_SESSION_RENEWAL_THRESHOLD_MINUTES) || 0
  },

  // 🎯 Claude API配置
  claude: {
    apiUrl: process.env.CLAUDE_API_URL || 'https://api.anthropic.com/v1/messages',
    apiVersion: process.env.CLAUDE_API_VERSION || '2023-06-01',
    betaHeader:
      process.env.CLAUDE_BETA_HEADER ||
      'claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14',
    overloadHandling: {
      enabled: (() => {
        const minutes = parseInt(process.env.CLAUDE_OVERLOAD_HANDLING_MINUTES) || 0
        // 验证配置值：限制在0-1440分钟(24小时)内
        return Math.max(0, Math.min(minutes, 1440))
      })()
    }
  },

  // ☁️ Bedrock API配置
  bedrock: {
    enabled: process.env.CLAUDE_CODE_USE_BEDROCK === '1',
    defaultRegion: process.env.AWS_REGION || 'us-east-1',
    smallFastModelRegion: process.env.ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION,
    defaultModel: process.env.ANTHROPIC_MODEL || 'us.anthropic.claude-sonnet-4-20250514-v1:0',
    smallFastModel:
      process.env.ANTHROPIC_SMALL_FAST_MODEL || 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
    maxOutputTokens: parseInt(process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS) || 4096,
    maxThinkingTokens: parseInt(process.env.MAX_THINKING_TOKENS) || 1024,
    enablePromptCaching: process.env.DISABLE_PROMPT_CACHING !== '1'
  },

  // 🌐 代理配置
  proxy: {
    timeout: parseInt(process.env.DEFAULT_PROXY_TIMEOUT) || 600000, // 10分钟
    maxRetries: parseInt(process.env.MAX_PROXY_RETRIES) || 3,
    // IP协议族配置：true=IPv4, false=IPv6, 默认IPv4（兼容性更好）
    useIPv4: process.env.PROXY_USE_IPV4 !== 'false' // 默认 true，只有明确设置为 'false' 才使用 IPv6
  },

  // ⏱️ 请求超时配置
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 600000, // 默认 10 分钟

  // 📈 使用限制
  limits: {
    defaultTokenLimit: parseInt(process.env.DEFAULT_TOKEN_LIMIT) || 1000000
  },

  // 💰 费用计算配置
  billing: {
    // 费用乘数系数 - 用于在原有费用基础上进行调整
    // 
    // 【重要说明】此系数的作用范围：
    // 
    // ✅ 会影响的部分（应用乘数系数）：
    //   1. 前端界面显示的所有费用和Tokens数量
    //   2. API统计接口返回的费用和Tokens数据
    //   3. API Key的费用限制判断（每日限制、总费用限制、时间窗口费用限制）
    //   4. 计费事件和Webhook通知中的费用和Tokens
    //   5. 所有用户可见的费用和Tokens信息
    // 
    // ❌ 不影响的部分（使用原始数据）：
    //   1. Claude OAuth账户的窗口限制判断（5小时、7天窗口，基于OAuth API）
    //   2. 账户调度和轮询逻辑
    //   3. 账户池的账户选择策略
    //   4. 后端内部的账户使用率计算
    // 
    // 【核心特性】：
    //   - 费用和Tokens会同时按相同系数缩放
    //   - 费用/Tokens 的比例保持不变（即单价不变）
    //   - 用户看到放大/缩小后的费用和Tokens，但单价保持一致
    // 
    // 【使用场景】：
    //   - 例如：设置为 1.2，用户看到的费用和Tokens都变为120%，但$0.001/1000tokens的单价不变
    //   - 例如：设置为 0.8，用户看到的费用和Tokens都变为80%，但单价保持一致
    //   - 设置为 1.0 表示使用原始数据（默认值）
    // 
    // 【实现原理】：
    //   系统内部维护两套计算：
    //   1. calculateCost() - 应用乘数，费用×1.2 & tokens×1.2 → 单价不变
    //   2. calculateRawCost() - 原始数据，用于后端账户管理
    //   这样可以在不影响账户调度的前提下，灵活调整用户侧的显示数据
    // 
    costMultiplier: parseFloat(process.env.COST_MULTIPLIER) || 1.0
  },

  // �📝 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dirname: path.join(__dirname, '..', 'logs'),
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5
  },

  // 🔧 系统配置
  system: {
    cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL) || 3600000, // 1小时
    tokenUsageRetention: parseInt(process.env.TOKEN_USAGE_RETENTION) || 2592000000, // 30天
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 60000, // 1分钟
    timezone: process.env.SYSTEM_TIMEZONE || 'Asia/Shanghai', // 默认UTC+8（中国时区）
    timezoneOffset: parseInt(process.env.TIMEZONE_OFFSET) || 8 // UTC偏移小时数，默认+8
  },

  // 🎨 Web界面配置
  web: {
    title: process.env.WEB_TITLE || 'Claude Relay Service',
    description:
      process.env.WEB_DESCRIPTION ||
      'Multi-account Claude API relay service with beautiful management interface',
    logoUrl: process.env.WEB_LOGO_URL || '/assets/logo.png',
    enableCors: process.env.ENABLE_CORS === 'true',
    sessionSecret: process.env.WEB_SESSION_SECRET || 'CHANGE-THIS-SESSION-SECRET'
  },

  // 🔐 LDAP 认证配置
  ldap: {
    enabled: process.env.LDAP_ENABLED === 'true',
    server: {
      url: process.env.LDAP_URL || 'ldap://localhost:389',
      bindDN: process.env.LDAP_BIND_DN || 'cn=admin,dc=example,dc=com',
      bindCredentials: process.env.LDAP_BIND_PASSWORD || 'admin',
      searchBase: process.env.LDAP_SEARCH_BASE || 'dc=example,dc=com',
      searchFilter: process.env.LDAP_SEARCH_FILTER || '(uid={{username}})',
      searchAttributes: process.env.LDAP_SEARCH_ATTRIBUTES
        ? process.env.LDAP_SEARCH_ATTRIBUTES.split(',')
        : ['dn', 'uid', 'cn', 'mail', 'givenName', 'sn'],
      timeout: parseInt(process.env.LDAP_TIMEOUT) || 5000,
      connectTimeout: parseInt(process.env.LDAP_CONNECT_TIMEOUT) || 10000,
      // TLS/SSL 配置
      tls: {
        // 是否忽略证书错误 (用于自签名证书)
        rejectUnauthorized: process.env.LDAP_TLS_REJECT_UNAUTHORIZED !== 'false', // 默认验证证书，设置为false则忽略
        // CA证书文件路径 (可选，用于自定义CA证书)
        ca: process.env.LDAP_TLS_CA_FILE
          ? require('fs').readFileSync(process.env.LDAP_TLS_CA_FILE)
          : undefined,
        // 客户端证书文件路径 (可选，用于双向认证)
        cert: process.env.LDAP_TLS_CERT_FILE
          ? require('fs').readFileSync(process.env.LDAP_TLS_CERT_FILE)
          : undefined,
        // 客户端私钥文件路径 (可选，用于双向认证)
        key: process.env.LDAP_TLS_KEY_FILE
          ? require('fs').readFileSync(process.env.LDAP_TLS_KEY_FILE)
          : undefined,
        // 服务器名称 (用于SNI，可选)
        servername: process.env.LDAP_TLS_SERVERNAME || undefined
      }
    },
    userMapping: {
      username: process.env.LDAP_USER_ATTR_USERNAME || 'uid',
      displayName: process.env.LDAP_USER_ATTR_DISPLAY_NAME || 'cn',
      email: process.env.LDAP_USER_ATTR_EMAIL || 'mail',
      firstName: process.env.LDAP_USER_ATTR_FIRST_NAME || 'givenName',
      lastName: process.env.LDAP_USER_ATTR_LAST_NAME || 'sn'
    }
  },

  // 👥 用户管理配置
  userManagement: {
    enabled: process.env.USER_MANAGEMENT_ENABLED === 'true',
    defaultUserRole: process.env.DEFAULT_USER_ROLE || 'user',
    userSessionTimeout: parseInt(process.env.USER_SESSION_TIMEOUT) || 86400000, // 24小时
    maxApiKeysPerUser: parseInt(process.env.MAX_API_KEYS_PER_USER) || 1,
    allowUserDeleteApiKeys: process.env.ALLOW_USER_DELETE_API_KEYS === 'true' // 默认不允许用户删除自己的API Keys
  },

  // 📢 Webhook通知配置
  webhook: {
    enabled: process.env.WEBHOOK_ENABLED !== 'false', // 默认启用
    urls: process.env.WEBHOOK_URLS
      ? process.env.WEBHOOK_URLS.split(',').map((url) => url.trim())
      : [],
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT) || 10000, // 10秒超时
    retries: parseInt(process.env.WEBHOOK_RETRIES) || 3 // 重试3次
  },

  // 🛠️ 开发配置
  development: {
    debug: process.env.DEBUG === 'true',
    hotReload: process.env.HOT_RELOAD === 'true'
  }
}

module.exports = config
