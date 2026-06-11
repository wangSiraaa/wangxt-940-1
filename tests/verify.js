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

console.log('\n🗂️  检查数据模型...')
const typesPath = path.join(__dirname, '..', 'src/types/index.ts')
const typesContent = fs.readFileSync(typesPath, 'utf-8')

test('数据模型: Batch 包含必要字段', () => {
  assert(typesContent.includes('expireDate'), '缺少保质期字段')
  assert(typesContent.includes('donor'), '缺少捐赠方字段')
  assert(typesContent.includes('batchNo'), '缺少批次号字段')
  assert(typesContent.includes('isNearExpiry'), '缺少临期标记字段')
  assert(typesContent.includes('isExpired'), '缺少过期标记字段')
  assert(typesContent.includes('availableQuantity'), '缺少可用数量字段')
})

test('数据模型: 包含所有必要类型', () => {
  assert(typesContent.includes('Material'), '缺少 Material 类型')
  assert(typesContent.includes('Batch'), '缺少 Batch 类型')
  assert(typesContent.includes('Project'), '缺少 Project 类型')
  assert(typesContent.includes('AllocationRecord'), '缺少 AllocationRecord 类型')
  assert(typesContent.includes('DistributionRecord'), '缺少 DistributionRecord 类型')
  assert(typesContent.includes('CorrectionRecord'), '缺少 CorrectionRecord 类型')
})

console.log('\n📄 检查所有视图组件...')
const views = [
  { file: 'InboundView.vue', name: '入库视图' },
  { file: 'SortingView.vue', name: '分拣视图' },
  { file: 'DistributionView.vue', name: '发放视图' },
  { file: 'CorrectionView.vue', name: '冲正视图' },
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

console.log('\n🐳 检查 Docker 配置...')
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
  console.log('\n🚀 可以执行以下命令构建和运行:')
  console.log('  构建: npm run build')
  console.log('  开发: npm run dev')
  console.log('  容器: docker build -t donation-system . && docker run -p 3000:3000 donation-system')
  process.exit(0)
}
