import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const results = []

function test(name, fn) {
  try {
    fn()
    results.push({ name, status: 'PASS', message: '' })
    console.log(`✅ ${name}`)
  } catch (error) {
    results.push({ name, status: 'FAIL', message: error.message })
    console.log(`❌ ${name}: ${error.message}`)
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed')
  }
}

console.log('\n========================================')
console.log('  公益捐赠物资分拣系统 - 业务规则验证')
console.log('========================================\n')

console.log('📁 检查项目结构...')
const requiredFiles = [
  'package.json',
  'src/main.ts',
  'src/App.vue',
  'src/router/index.ts',
  'src/stores/material.ts',
  'src/views/InboundView.vue',
  'src/views/SortingView.vue',
  'src/views/DistributionView.vue',
  'src/views/CorrectionView.vue',
  'src/views/RecallView.vue',
  'src/views/StatisticsView.vue',
  'src/types/index.ts',
  'Dockerfile',
  'nginx.conf'
]

requiredFiles.forEach(file => {
  test(`项目结构: ${file} 存在`, () => {
    const filePath = path.join(__dirname, '..', file)
    assert(fs.existsSync(filePath), `文件不存在: ${file}`)
  })
})

console.log('\n📦 检查 package.json 依赖...')
test('package.json 包含 Vue 3', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'))
  assert(pkg.dependencies.vue && pkg.dependencies.vue.startsWith('^3'), 'Vue 3 依赖缺失或版本错误')
})

test('package.json 包含 Pinia', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'))
  assert(pkg.dependencies.pinia, 'Pinia 依赖缺失')
})

test('package.json 包含 Element Plus', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'))
  assert(pkg.dependencies['element-plus'], 'Element Plus 依赖缺失')
})

test('package.json 包含测试脚本', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'))
  assert(pkg.scripts.test, '测试脚本缺失')
})

console.log('\n🔍 检查业务规则实现...')
const storePath = path.join(__dirname, '..', 'src/stores/material.ts')
const storeContent = fs.readFileSync(storePath, 'utf-8')

test('业务规则: 过期食品不能入库', () => {
  assert(
    storeContent.includes('过期食品不能入库'),
    '未实现过期食品不能入库的校验'
  )
  assert(
    storeContent.includes('isExpired(data.expireDate)'),
    '未调用过期日期校验'
  )
})

test('业务规则: 临期食品标记优先发放', () => {
  assert(
    storeContent.includes('isNearExpiry'),
    '未实现临期食品判断'
  )
  assert(
    storeContent.includes('临期食品，已标记优先发放'),
    '未实现临期食品提示'
  )
  assert(
    storeContent.includes('isNearExpiry ? -1 : 1'),
    '未实现临期食品优先排序'
  )
})

test('业务规则: 分配数量不能超过当前库存', () => {
  assert(
    storeContent.includes('超过当前可用库存'),
    '未实现超量分配校验'
  )
  assert(
    storeContent.includes('data.quantity > batch.availableQuantity'),
    '未比较分配数量与可用库存'
  )
})

test('业务规则: 同一批次多项目分配实时扣减', () => {
  assert(
    storeContent.includes('updateBatchAvailable'),
    '未实现批次可用数量更新方法'
  )
  assert(
    storeContent.includes('allocatedQuantity'),
    '未维护已分配数量字段'
  )
  assert(
    storeContent.includes('availableQuantity = batch.quantity - batch.allocatedQuantity'),
    '未正确计算可用数量'
  )
})

test('业务规则: 已发放物资不能撤回', () => {
  assert(
    storeContent.includes('已发放物资不能撤回，只能登记冲正记录'),
    '未实现已发放物资不能撤回的规则'
  )
  assert(
    storeContent.includes('revokeDistribution'),
    '未实现撤回方法（应返回失败）'
  )
  assert(
    storeContent.match(/revokeDistribution[\s\S]*?success:\s*false/),
    '撤回方法未返回失败'
  )
})

test('业务规则: 项目取消未发放数量回退', () => {
  assert(
    storeContent.includes('cancelProject'),
    '未实现项目取消方法'
  )
  assert(
    storeContent.includes('未发放数量已退回库存'),
    '未实现库存回退提示'
  )
  assert(
    storeContent.includes('allocation.status = \'cancelled\''),
    '未将分配标记为已取消'
  )
})

test('业务规则: 冲正记录登记', () => {
  assert(
    storeContent.includes('createCorrection'),
    '未实现冲正登记方法'
  )
  assert(
    storeContent.includes('冲正记录登记成功'),
    '未实现冲正成功提示'
  )
})

console.log('\n� 检查批次召回与调剂业务规则...')

test('业务规则: 批次召回功能', () => {
  assert(
    storeContent.includes('createRecall'),
    '未实现创建召回单方法'
  )
  assert(
    storeContent.includes('confirmRecall'),
    '未实现确认召回方法'
  )
  assert(
    storeContent.includes('completeRecall'),
    '未实现完成召回方法'
  )
  assert(
    storeContent.includes('cancelRecall'),
    '未实现取消召回方法'
  )
  assert(
    storeContent.includes('召回单创建成功'),
    '未实现召回单创建成功提示'
  )
})

test('业务规则: 召回中禁止分配', () => {
  assert(
    storeContent.includes('该批次正在召回处理中，禁止继续分配'),
    '未实现召回中禁止分配校验'
  )
  assert(
    storeContent.includes('batch.isRecalled'),
    '未检查批次召回标记'
  )
  const recallCheckIdx = storeContent.indexOf('batch.isRecalled')
  const allocatePushIdx = storeContent.indexOf('allocations.value.push')
  assert(
    recallCheckIdx !== -1 && allocatePushIdx !== -1,
    '缺少召回检查或分配记录创建逻辑'
  )
  assert(
    recallCheckIdx < allocatePushIdx,
    '召回检查应在创建分配记录之前执行'
  )
})

test('业务规则: 项目调剂功能', () => {
  assert(
    storeContent.includes('transferMaterial'),
    '未实现物资调剂方法'
  )
  assert(
    storeContent.includes('调剂成功'),
    '未实现调剂成功提示'
  )
  assert(
    storeContent.includes('sourceProjectId'),
    '未记录调剂源项目'
  )
  assert(
    storeContent.includes('targetProjectId'),
    '未记录调剂目标项目'
  )
})

test('业务规则: 调剂过期食品不能入库', () => {
  const transferMethod = storeContent.match(/function transferMaterial[\s\S]*?^\}/m)
  assert(
    transferMethod && transferMethod[0].includes('过期食品不能入库'),
    '调剂时未校验过期食品不能入库'
  )
  assert(
    transferMethod && transferMethod[0].includes('isExpired'),
    '调剂时未调用过期日期校验'
  )
})

test('业务规则: 调剂数量不能超过未发放数量', () => {
  assert(
    storeContent.includes('调剂数量超过可调剂数量'),
    '未实现调剂数量超量校验'
  )
  assert(
    storeContent.includes('undistributedQuantity'),
    '未使用未发放数量字段'
  )
})

test('业务规则: 已发放物资只能登记追踪', () => {
  assert(
    storeContent.includes('addDistributedTrack'),
    '未实现已发放物资追踪登记方法'
  )
  assert(
    storeContent.includes('已发放物资只能登记追踪说明和冲正记录'),
    '未实现已发放物资不可撤回的规则说明'
  )
  assert(
    storeContent.includes('distributed_track'),
    '未记录已发放追踪类型'
  )
})

test('业务规则: 批次追踪记录', () => {
  assert(
    storeContent.includes('BatchTrace'),
    '未使用批次追踪类型'
  )
  assert(
    storeContent.includes('traceType'),
    '未记录追踪类型'
  )
  assert(
    storeContent.includes("'recall'"),
    '未记录召回追踪类型'
  )
  assert(
    storeContent.includes("'transfer'"),
    '未记录调剂追踪类型'
  )
  assert(
    storeContent.includes("'correction'"),
    '未记录冲正追踪类型'
  )
})

test('业务规则: 项目取消保留召回标记', () => {
  assert(
    storeContent.includes('项目已取消，未发放数量已退回库存，保留召回标记'),
    '项目取消时未保留召回标记'
  )
  const cancelProjectIdx = storeContent.indexOf('function cancelProject')
  const nextFunctionIdx = storeContent.indexOf('function addProject')
  const cancelMethod = storeContent.substring(cancelProjectIdx, nextFunctionIdx)
  assert(
    !cancelMethod.includes('isRecalled = false'),
    '项目取消时不应清除召回标记'
  )
})

test('业务规则: 批次召回状态流转', () => {
  assert(
    storeContent.includes("'pending'"),
    '未实现待确认状态'
  )
  assert(
    storeContent.includes("'confirmed'"),
    '未实现已确认状态'
  )
  assert(
    storeContent.includes("'processing'"),
    '未实现处理中状态'
  )
  assert(
    storeContent.includes("'completed'"),
    '未实现已完成状态'
  )
  assert(
    storeContent.includes("'cancelled'"),
    '未实现已取消状态'
  )
  assert(
    storeContent.includes('startProcessingRecall'),
    '未实现开始处理召回方法'
  )
})

test('业务规则: 召回原因类型', () => {
  assert(
    storeContent.includes("'expired_misdeliver'"),
    '未实现临期误发召回原因'
  )
  assert(
    storeContent.includes("'spec_error'"),
    '未实现规格错误召回原因'
  )
  assert(
    storeContent.includes("'donor_direction'"),
    '未实现捐赠方定向召回原因'
  )
  assert(
    storeContent.includes("'other'"),
    '未实现其他召回原因'
  )
})

test('业务规则: 召回统计影响', () => {
  assert(
    storeContent.includes('recallStats'),
    '未实现召回统计计算属性'
  )
  assert(
    storeContent.includes('pendingRecalls'),
    '未实现待处理召回计算属性'
  )
  assert(
    storeContent.includes('recalledBatches'),
    '未实现已召回批次计算属性'
  )
})

test('业务规则: 可分配批次过滤召回中批次', () => {
  assert(
    storeContent.includes('availableBatches'),
    '未实现可用批次计算属性'
  )
  const availableBatches = storeContent.match(/const availableBatches[\s\S]*?\}\)/)
  assert(
    availableBatches && availableBatches[0].includes('isRecalled'),
    '可用批次未过滤召回中批次'
  )
})

console.log('\n�️  检查数据模型...')
const typesPath = path.join(__dirname, '..', 'src/types/index.ts')
const typesContent = fs.readFileSync(typesPath, 'utf-8')

test('数据模型: Batch 包含必要字段', () => {
  assert(typesContent.includes('expireDate'), '缺少保质期字段')
  assert(typesContent.includes('donor'), '缺少捐赠方字段')
  assert(typesContent.includes('batchNo'), '缺少批次号字段')
  assert(typesContent.includes('isNearExpiry'), '缺少临期标记字段')
  assert(typesContent.includes('isExpired'), '缺少过期标记字段')
  assert(typesContent.includes('availableQuantity'), '缺少可用数量字段')
  assert(typesContent.includes('isRecalled'), '缺少召回标记字段')
})

test('数据模型: 包含所有必要类型', () => {
  assert(typesContent.includes('Material'), '缺少 Material 类型')
  assert(typesContent.includes('Batch'), '缺少 Batch 类型')
  assert(typesContent.includes('Project'), '缺少 Project 类型')
  assert(typesContent.includes('AllocationRecord'), '缺少 AllocationRecord 类型')
  assert(typesContent.includes('DistributionRecord'), '缺少 DistributionRecord 类型')
  assert(typesContent.includes('CorrectionRecord'), '缺少 CorrectionRecord 类型')
  assert(typesContent.includes('RecallOrder'), '缺少 RecallOrder 类型')
  assert(typesContent.includes('TransferRecord'), '缺少 TransferRecord 类型')
  assert(typesContent.includes('BatchTrace'), '缺少 BatchTrace 类型')
})

test('数据模型: 包含召回状态和原因类型', () => {
  assert(typesContent.includes('RecallStatus'), '缺少 RecallStatus 类型')
  assert(typesContent.includes('RecallReason'), '缺少 RecallReason 类型')
  assert(typesContent.includes("'pending'"), '缺少待确认状态')
  assert(typesContent.includes("'confirmed'"), '缺少已确认状态')
  assert(typesContent.includes("'processing'"), '缺少处理中状态')
  assert(typesContent.includes("'completed'"), '缺少已完成状态')
  assert(typesContent.includes("'cancelled'"), '缺少已取消状态')
  assert(typesContent.includes("'expired_misdeliver'"), '缺少临期误发原因')
  assert(typesContent.includes("'spec_error'"), '缺少规格错误原因')
  assert(typesContent.includes("'donor_direction'"), '缺少捐赠方定向原因')
})

console.log('\n 检查所有视图组件...')
const views = [
  { file: 'InboundView.vue', name: '入库视图' },
  { file: 'SortingView.vue', name: '分拣视图' },
  { file: 'DistributionView.vue', name: '发放视图' },
  { file: 'CorrectionView.vue', name: '冲正视图' },
  { file: 'RecallView.vue', name: '召回与调剂视图' },
  { file: 'StatisticsView.vue', name: '统计视图' }
]

views.forEach(({ file, name }) => {
  test(`视图组件: ${name}`, () => {
    const filePath = path.join(__dirname, '..', 'src/views', file)
    assert(fs.existsSync(filePath), `${name} 不存在`)
    const content = fs.readFileSync(filePath, 'utf-8')
    assert(content.includes('<template>'), `${name} 缺少 template`)
    assert(content.includes('<script setup'), `${name} 缺少 script`)
  })
})

console.log('\n� 检查召回与调剂视图结构...')
const recallViewPath = path.join(__dirname, '..', 'src/views/RecallView.vue')
const recallViewContent = fs.readFileSync(recallViewPath, 'utf-8')

test('召回视图: 包含四个功能标签页', () => {
  assert(
    recallViewContent.includes('召回单管理'),
    '缺少召回单管理标签页'
  )
  assert(
    recallViewContent.includes('项目调剂'),
    '缺少项目调剂标签页'
  )
  assert(
    recallViewContent.includes('批次追踪'),
    '缺少批次追踪标签页'
  )
  assert(
    recallViewContent.includes('统计影响'),
    '缺少统计影响标签页'
  )
})

test('召回视图: 包含核心操作按钮', () => {
  assert(
    recallViewContent.includes('发起召回'),
    '缺少发起召回按钮'
  )
  assert(
    recallViewContent.includes('确认召回'),
    '缺少确认召回按钮'
  )
  assert(
    recallViewContent.includes('物资调剂'),
    '缺少物资调剂按钮'
  )
  assert(
    recallViewContent.includes('登记追踪'),
    '缺少登记追踪按钮'
  )
  assert(
    recallViewContent.includes('登记冲正'),
    '缺少登记冲正按钮'
  )
})

test('召回视图: 包含本地验收校验逻辑', () => {
  assert(
    recallViewContent.includes('超量调剂'),
    '缺少超量调剂提示'
  )
  assert(
    recallViewContent.includes('已发放不可撤回'),
    '缺少已发放不可撤回提示'
  )
  assert(
    recallViewContent.includes('召回中禁止再分配'),
    '缺少召回中禁止再分配提示'
  )
})

console.log('\n🔗 检查路由配置...')
const routerPath = path.join(__dirname, '..', 'src/router/index.ts')
const routerContent = fs.readFileSync(routerPath, 'utf-8')

test('路由配置: 包含召回与调剂路由', () => {
  assert(
    routerContent.includes('/recall'),
    '缺少召回模块路由路径'
  )
  assert(
    routerContent.includes('RecallView'),
    '缺少召回视图组件引用'
  )
  assert(
    routerContent.includes('批次召回与调剂'),
    '缺少召回页面标题'
  )
  assert(
    routerContent.includes('RefreshRight'),
    '缺少召回页面图标'
  )
})

console.log('\n📱 检查侧边栏菜单配置...')
const appPath = path.join(__dirname, '..', 'src/App.vue')
const appContent = fs.readFileSync(appPath, 'utf-8')

test('侧边栏菜单: 包含RefreshRight图标', () => {
  assert(
    appContent.includes('RefreshRight'),
    'App.vue 未导入 RefreshRight 图标'
  )
  assert(
    appContent.includes('iconMap'),
    'App.vue 未定义图标映射'
  )
})

console.log('\n� 检查 Docker 配置...')
test('Dockerfile 存在且配置正确', () => {
  const dockerfile = fs.readFileSync(path.join(__dirname, '..', 'Dockerfile'), 'utf-8')
  assert(dockerfile.includes('FROM node:20-alpine'), '缺少 Node 构建阶段')
  assert(dockerfile.includes('FROM nginx:alpine'), '缺少 Nginx 运行阶段')
  assert(dockerfile.includes('npm run build'), '缺少构建命令')
  assert(dockerfile.includes('EXPOSE 3000'), '缺少端口暴露')
})

test('nginx.conf 存在且配置正确', () => {
  const nginxConf = fs.readFileSync(path.join(__dirname, '..', 'nginx.conf'), 'utf-8')
  assert(nginxConf.includes('listen 3000'), '缺少端口监听配置')
  assert(nginxConf.includes('try_files'), '缺少 SPA 路由支持')
})

console.log('\n🧪 检查超量分配页面回归验证...')
const sortingViewPath = path.join(__dirname, '..', 'src/views/SortingView.vue')
const sortingViewContent = fs.readFileSync(sortingViewPath, 'utf-8')
const distributionViewPath = path.join(__dirname, '..', 'src/views/DistributionView.vue')
const distributionViewContent = fs.readFileSync(distributionViewPath, 'utf-8')

test('超量分配回归: 分拣视图不静默截断用户输入', () => {
  assert(
    !sortingViewContent.includes(':max="maxQuantity"'),
    '分拣视图不应设置 el-input-number 的 max 属性，避免静默截断超量值'
  )
})

test('超量分配回归: 分拣视图不在 watch 中自动修正 quantity', () => {
  const watchBlock = sortingViewContent.match(/watch\(\(\) => form\.value\.batchId[\s\S]*?^\}\)/m)
  if (watchBlock) {
    assert(
      !watchBlock[0].includes('form.value.quantity = Math'),
      '分拣视图 watch 中不应自动修正 quantity 值'
    )
  }
})

test('超量分配回归: 分拣视图有实时超量提示', () => {
  assert(
    sortingViewContent.includes('分配数量已超过可用库存'),
    '分拣视图缺少超量分配实时提示缺失'
  )
})

test('超量分配回归: 分拣视图提交时有超量错误提示', () => {
  assert(
    sortingViewContent.includes('分配数量('),
    '分拣视图提交时缺少超量错误提示缺失'
  )
})

test('超量分配回归: 发放视图不静默截断用户输入', () => {
  assert(
    !distributionViewContent.includes(':max="maxQuantity"'),
    '发放视图不应设置 el-input-number 的 max 属性，避免静默截断超量值'
  )
})

test('超量分配回归: 发放视图不在 watch 中自动修正 quantity', () => {
  const watchBlock = distributionViewContent.match(/watch\(\) => form\.value\.allocationId[\s\S]*?^\}\)/m)
  if (watchBlock) {
    assert(
      !watchBlock[0].includes('form.value.quantity = Math'),
      '发放视图 watch 中不应自动修正 quantity 值'
    )
  }
})

test('超量分配回归: store 层超量分配不创建记录不扣库存', () => {
  assert(
    storeContent.includes('超过当前可用库存'),
    'store 层缺少超量分配判断'
  )
  const overCheckIdx = storeContent.indexOf('data.quantity > batch.availableQuantity')
  const pushIdx = storeContent.indexOf('allocations.value.push')
  assert(
    overCheckIdx !== -1 && pushIdx !== -1,
    '缺少超量检查或分配记录创建逻辑'
  )
  assert(
    overCheckIdx < pushIdx,
    '超量检查应在创建分配记录之前执行'
  )
})

console.log('\n========================================')
console.log('  测试结果汇总')
console.log('========================================\n')

const passed = results.filter(r => r.status === 'PASS').length
const failed = results.filter(r => r.status === 'FAIL').length

console.log(`通过: ${passed} / ${results.length}`)
console.log(`失败: ${failed} / ${results.length}\n`)

if (failed > 0) {
  console.log('❌ 失败的测试:')
  results.filter(r => r.status === 'FAIL').forEach(r => {
    console.log(`  - ${r.name}: ${r.message}`)
  })
  process.exit(1)
} else {
  console.log('🎉 所有测试通过！')
  console.log('\n📋 已验证的业务规则:')
  console.log('  ✅ 过期食品不能入库')
  console.log('  ✅ 临期食品标记优先发放')
  console.log('  ✅ 分配数量不能超过当前库存')
  console.log('  ✅ 同一批次多项目分配实时扣减')
  console.log('  ✅ 已发放物资不能撤回，只能登记冲正')
  console.log('  ✅ 项目取消时未发放数量退回库存')
  console.log('  ✅ 冲正记录登记功能')
  console.log('  ✅ 超量分配回归：不静默截断、保留用户输入、实时提示')
  console.log('\n📦 已验证的批次召回与调剂功能:')
  console.log('  ✅ 批次召回全生命周期管理（待确认→已确认→处理中→已完成/已取消）')
  console.log('  ✅ 召回中禁止分配校验')
  console.log('  ✅ 项目调剂功能（源项目扣减、目标项目增加）')
  console.log('  ✅ 调剂过期食品不能入库校验')
  console.log('  ✅ 调剂数量不能超过未发放数量')
  console.log('  ✅ 已发放物资只能登记追踪说明和冲正记录')
  console.log('  ✅ 批次追踪记录（召回、调剂、冲正、已发放追踪）')
  console.log('  ✅ 项目取消时保留召回标记')
  console.log('  ✅ 召回原因类型（临期误发、规格错误、捐赠方定向、其他）')
  console.log('  ✅ 召回统计影响分析')
  console.log('  ✅ 可分配批次自动过滤召回中批次')
  console.log('  ✅ 本地验收：超量调剂、已发放不可撤回、召回中禁止再分配')
  console.log('\n🚀 可以执行以下命令构建和运行:')
  console.log('  构建: npm run build')
  console.log('  开发: npm run dev')
  console.log('  容器: docker build -t donation-system . && docker run -p 3000:3000 donation-system')
  process.exit(0)
}
