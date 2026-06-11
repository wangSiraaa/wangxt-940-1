<template>
  <div class="sorting-view">
    <el-card class="form-card">
      <template #header>
        <div class="card-header">
          <span>物资分配（分拣）</span>
          <el-tag type="warning">仓库管理员分配</el-tag>
        </div>
      </template>
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="项目" prop="projectId">
              <el-select v-model="form.projectId" placeholder="请选择项目" style="width: 100%">
                <el-option
                  v-for="p in store.activeProjects"
                  :key="p.id"
                  :label="p.name"
                  :value="p.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="批次" prop="batchId">
              <el-select v-model="form.batchId" placeholder="选择批次（临期优先显示）" style="width: 100%">
                <el-option
                  v-for="b in availableBatchesWithLabel"
                  :key="b.id"
                  :label="b.label"
                  :value="b.id"
                >
                  <span style="float: left">{{ b.materialName }} - {{ b.batchNo }}</span>
                  <span style="float: right; color: #8492a6; font-size: 13px">
                    可用: {{ b.availableQuantity }}
                    <el-tag v-if="b.isNearExpiry" type="warning" size="small" style="margin-left: 5px">
                      临期
                    </el-tag>
                  </span>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="分配数量" prop="quantity">
              <el-input-number
                v-model="form.quantity"
                :min="1"
                :max="maxQuantity"
                style="width: 100%"
              />
              <div class="tip">
                当前可用库存: <b>{{ currentAvailable }}</b>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="操作员" prop="operator">
              <el-input v-model="form.operator" placeholder="请输入操作员姓名" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item>
          <el-button type="primary" @click="handleSubmit" :loading="submitting">
            分配
          </el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="list-card">
      <template #header>
        <div class="card-header">
          <span>分配记录</span>
          <div>
            <el-select v-model="filterStatus" placeholder="状态筛选" style="width: 120px; margin-right: 10px" clearable>
              <el-option label="待发放" value="pending" />
              <el-option label="部分发放" value="partial" />
              <el-option label="已完成" value="completed" />
              <el-option label="已取消" value="cancelled" />
            </el-select>
            <el-button type="danger" @click="handleCancelProject" :disabled="!selectedProject">
              取消选中项目
            </el-button>
          </div>
        </div>
      </template>
      <el-table
        :data="filteredAllocations"
        stripe
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="projectName" label="项目" width="140" />
        <el-table-column prop="materialName" label="物资" width="100" />
        <el-table-column prop="batchNo" label="批次号" width="180" />
        <el-table-column prop="category" label="分类" width="80">
          <template #default="{ row }">
            {{ getCategoryName(row.category) }}
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="分配数量" width="100" />
        <el-table-column prop="distributedQuantity" label="已发放" width="80" />
        <el-table-column prop="availableQuantity" label="待发放" width="80" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">
              {{ getStatusName(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="操作员" width="100" />
        <el-table-column prop="createDate" label="分配日期" width="120" />
      </el-table>
    </el-card>

    <el-card class="stock-card">
      <template #header>
        <span>实时可用库存</span>
      </template>
      <el-table :data="store.availableBatches" stripe style="width: 100%">
        <el-table-column prop="batchNo" label="批次号" width="180" />
        <el-table-column prop="materialName" label="物资" width="100" />
        <el-table-column prop="category" label="分类" width="80">
          <template #default="{ row }">
            {{ getCategoryName(row.category) }}
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="总库存" width="80" />
        <el-table-column prop="availableQuantity" label="可用数量" width="100">
          <template #default="{ row }">
            <b style="color: #409eff">{{ row.availableQuantity }}</b>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.isNearExpiry" type="warning" size="small">临期优先</el-tag>
            <el-tag v-else type="success" size="small">正常</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="expireDate" label="保质期" width="120">
          <template #default="{ row }">
            {{ formatDate(row.expireDate) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { useMaterialStore } from '@/stores/material'
import { formatDate } from '@/utils/date'
import type { MaterialCategory, AllocationRecord } from '@/types'

const store = useMaterialStore()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const filterStatus = ref<string>('')
const selectedProject = ref<string | null>(null)

interface AllocationForm {
  projectId: string
  batchId: string
  quantity: number
  operator: string
}

const form = ref<AllocationForm>({
  projectId: '',
  batchId: '',
  quantity: 1,
  operator: ''
})

const rules: FormRules = {
  projectId: [{ required: true, message: '请选择项目', trigger: 'change' }],
  batchId: [{ required: true, message: '请选择批次', trigger: 'change' }],
  quantity: [{ required: true, message: '请输入分配数量', trigger: 'blur' }],
  operator: [{ required: true, message: '请输入操作员', trigger: 'blur' }]
}

const availableBatchesWithLabel = computed(() => {
  return store.availableBatches.map(b => ({
    ...b,
    label: `${b.materialName} - ${b.batchNo} (可用: ${b.availableQuantity})`
  }))
})

const currentBatch = computed(() => {
  return store.batches.find(b => b.id === form.value.batchId)
})

const currentAvailable = computed(() => {
  if (!currentBatch.value) return 0
  store.updateBatchAvailable(form.value.batchId)
  return currentBatch.value.availableQuantity
})

const maxQuantity = computed(() => {
  return Math.max(1, currentAvailable.value)
})

const filteredAllocations = computed(() => {
  return store.allocations
    .filter(a => !filterStatus.value || a.status === filterStatus.value)
    .sort((a, b) => b.createDate.localeCompare(a.createDate))
})

function getCategoryName(category: MaterialCategory): string {
  const map: Record<MaterialCategory, string> = {
    food: '食品',
    clothing: '衣物',
    daily: '日用品'
  }
  return map[category]
}

function getStatusName(status: string): string {
  const map: Record<string, string> = {
    pending: '待发放',
    partial: '部分发放',
    completed: '已完成',
    cancelled: '已取消'
  }
  return map[status] || status
}

function getStatusTagType(status: string): 'success' | 'warning' | 'info' | 'danger' {
  const map: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
    pending: 'warning',
    partial: 'warning',
    completed: 'success',
    cancelled: 'danger'
  }
  return map[status] || 'info'
}

function handleSelectionChange(selection: AllocationRecord[]) {
  if (selection.length > 0) {
    const projectIds = [...new Set(selection.map(s => s.projectId))]
    selectedProject.value = projectIds.length === 1 ? projectIds[0] : null
  } else {
    selectedProject.value = null
  }
}

async function handleCancelProject() {
  if (!selectedProject.value) return
  const project = store.projects.find(p => p.id === selectedProject.value)
  if (!project) return

  try {
    await ElMessageBox.confirm(
      `确定要取消项目"${project.name}"吗？\n取消后，该项目下未发放的物资将退回可分配库存。`,
      '取消项目确认',
      { type: 'warning', confirmButtonText: '确认取消', cancelButtonText: '再想想' }
    )
    const result = store.cancelProject(selectedProject.value)
    if (result.success) {
      ElMessage.success(result.message)
    } else {
      ElMessage.error(result.message)
    }
  } catch {
  }
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return

    if (form.value.quantity > currentAvailable.value) {
      ElMessage.error(`分配数量(${form.value.quantity})超过当前可用库存(${currentAvailable.value})`)
      return
    }

    submitting.value = true
    const result = store.allocateMaterial({
      projectId: form.value.projectId,
      batchId: form.value.batchId,
      quantity: form.value.quantity,
      operator: form.value.operator
    })
    submitting.value = false

    if (result.success) {
      ElMessage.success(result.message)
      resetForm()
    } else {
      ElMessage.error(result.message)
    }
  })
}

function resetForm() {
  form.value = {
    projectId: '',
    batchId: '',
    quantity: 1,
    operator: ''
  }
  formRef.value?.resetFields()
}

watch(() => form.value.batchId, () => {
  if (form.value.quantity > currentAvailable.value) {
    form.value.quantity = Math.max(1, currentAvailable.value)
  }
})

onMounted(() => {
  store.refreshBatchStatus()
  store.batches.forEach(b => store.updateBatchAvailable(b.id))
})
</script>

<style scoped>
.sorting-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}
</style>
