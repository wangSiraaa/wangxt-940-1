<template>
  <div class="distribution-view">
    <el-card class="form-card">
      <template #header>
        <div class="card-header">
          <span>物资发放</span>
          <el-tag type="success">项目负责人确认</el-tag>
        </div>
      </template>
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="项目" prop="projectId">
              <el-select
                v-model="form.projectId"
                placeholder="请选择项目"
                style="width: 100%"
                @change="handleProjectChange"
              >
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
            <el-form-item label="分配记录" prop="allocationId">
              <el-select
                v-model="form.allocationId"
                placeholder="请选择分配记录"
                style="width: 100%"
                :disabled="!form.projectId"
              >
                <el-option
                  v-for="a in projectAllocations"
                  :key="a.id"
                  :label="`${a.materialName} - 待发:${a.availableQuantity}`"
                  :value="a.id"
                >
                  <span style="float: left">{{ a.materialName }} ({{ a.batchNo }})</span>
                  <span style="float: right; color: #8492a6; font-size: 13px">
                    待发: {{ a.availableQuantity }} / {{ a.quantity }}
                  </span>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="发放数量" prop="quantity">
              <el-input-number
                v-model="form.quantity"
                :min="1"
                style="width: 100%"
              />
              <div class="tip">
                待发放数量: <b>{{ currentAvailable }}</b>
                <span v-if="form.quantity > currentAvailable" style="color: #f56c6c; margin-left: 10px">
                  ⚠ 发放数量已超过待发放数量
                </span>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="领取人" prop="receiver">
              <el-input v-model="form.receiver" placeholder="请输入领取人姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注" prop="remark">
              <el-input
                v-model="form.remark"
                type="textarea"
                :rows="2"
                placeholder="请输入备注信息（可选）"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item>
          <el-button type="primary" @click="handleSubmit" :loading="submitting">
            确认发放
          </el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="list-card">
      <template #header>
        <div class="card-header">
          <span>发放记录</span>
          <div>
            <el-input
              v-model="searchKeyword"
              placeholder="搜索物资/项目/领取人"
              style="width: 200px; margin-right: 10px"
              clearable
            />
          </div>
        </div>
      </template>
      <el-table :data="filteredDistributions" stripe style="width: 100%">
        <el-table-column prop="projectName" label="项目" width="140" />
        <el-table-column prop="materialName" label="物资" width="100" />
        <el-table-column prop="category" label="分类" width="80">
          <template #default="{ row }">
            {{ getCategoryName(row.category) }}
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="发放数量" width="100" />
        <el-table-column prop="receiver" label="领取人" width="100" />
        <el-table-column prop="receiveDate" label="领取日期" width="120" />
        <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button
              type="danger"
              size="small"
              @click="handleRevoke(row)"
            >
              撤回
            </el-button>
            <el-button
              type="warning"
              size="small"
              @click="handleCreateCorrection(row)"
            >
              冲正
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card class="stock-card">
      <template #header>
        <span>项目发放进度</span>
      </template>
      <el-table :data="projectProgress" stripe style="width: 100%">
        <el-table-column prop="projectName" label="项目" width="180" />
        <el-table-column prop="materialName" label="物资" width="120" />
        <el-table-column prop="quantity" label="分配总量" width="100" />
        <el-table-column prop="distributedQuantity" label="已发放" width="100" />
        <el-table-column prop="availableQuantity" label="待发放" width="100" />
        <el-table-column label="进度" width="200">
          <template #default="{ row }">
            <el-progress
              :percentage="Math.round((row.distributedQuantity / row.quantity) * 100)"
              :status="row.status === 'completed' ? 'success' : ''"
            />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">
              {{ getStatusName(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="correctionDialogVisible"
      title="登记冲正记录"
      width="500px"
    >
      <el-form :model="correctionForm" label-width="100px">
        <el-form-item label="原发放数量">
          <el-input :value="currentDistribution?.quantity" disabled />
        </el-form-item>
        <el-form-item label="冲正数量" prop="correctedQuantity">
          <el-input-number
            v-model="correctionForm.correctedQuantity"
            :min="0"
            :max="currentDistribution?.quantity || 0"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="冲正原因" prop="reason">
          <el-input
            v-model="correctionForm.reason"
            type="textarea"
            :rows="3"
            placeholder="请输入冲正原因"
          />
        </el-form-item>
        <el-form-item label="操作员" prop="operator">
          <el-input v-model="correctionForm.operator" placeholder="请输入操作员姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="correctionDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCorrection">确认登记</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { useMaterialStore } from '@/stores/material'
import type { MaterialCategory, DistributionRecord } from '@/types'

const store = useMaterialStore()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const searchKeyword = ref('')
const correctionDialogVisible = ref(false)
const currentDistribution = ref<DistributionRecord | null>(null)

interface DistributionForm {
  projectId: string
  allocationId: string
  quantity: number
  receiver: string
  remark: string
}

const form = ref<DistributionForm>({
  projectId: '',
  allocationId: '',
  quantity: 1,
  receiver: '',
  remark: ''
})

const correctionForm = ref({
  correctedQuantity: 0,
  reason: '',
  operator: ''
})

const rules: FormRules = {
  projectId: [{ required: true, message: '请选择项目', trigger: 'change' }],
  allocationId: [{ required: true, message: '请选择分配记录', trigger: 'change' }],
  quantity: [{ required: true, message: '请输入发放数量', trigger: 'blur' }],
  receiver: [{ required: true, message: '请输入领取人', trigger: 'blur' }]
}

const projectAllocations = computed(() => {
  if (!form.value.projectId) return []
  return store.allocations.filter(
    a => a.projectId === form.value.projectId &&
         a.status !== 'cancelled' &&
         a.availableQuantity > 0
  )
})

const currentAllocation = computed(() => {
  return store.allocations.find(a => a.id === form.value.allocationId)
})

const currentAvailable = computed(() => {
  if (!currentAllocation.value) return 0
  store.updateAllocationAvailable(form.value.allocationId)
  return currentAllocation.value.availableQuantity
})

const maxQuantity = computed(() => {
  return Math.max(1, currentAvailable.value)
})

const filteredDistributions = computed(() => {
  return store.distributions
    .filter(d => {
      if (!searchKeyword.value) return true
      return d.materialName.includes(searchKeyword.value) ||
             d.projectName.includes(searchKeyword.value) ||
             d.receiver.includes(searchKeyword.value)
    })
    .sort((a, b) => b.receiveDate.localeCompare(a.receiveDate))
})

const projectProgress = computed(() => {
  return store.allocations
    .filter(a => a.status !== 'cancelled')
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

function handleProjectChange() {
  form.value.allocationId = ''
  form.value.quantity = 1
}

async function handleRevoke(row: DistributionRecord) {
  try {
    await ElMessageBox.confirm(
      '确定要撤回这条发放记录吗？',
      '撤回确认',
      { type: 'warning', confirmButtonText: '确认撤回', cancelButtonText: '取消' }
    )
    const result = store.revokeDistribution(row.id)
    if (result.success) {
      ElMessage.success(result.message)
    } else {
      ElMessage.error(result.message)
    }
  } catch {
  }
}

function handleCreateCorrection(row: DistributionRecord) {
  const existingCorrection = store.corrections.find(c => c.distributionId === row.id)
  if (existingCorrection) {
    ElMessage.error('该发放记录已存在冲正记录')
    return
  }
  currentDistribution.value = row
  correctionForm.value = {
    correctedQuantity: row.quantity,
    reason: '',
    operator: ''
  }
  correctionDialogVisible.value = true
}

async function submitCorrection() {
  if (!currentDistribution.value) return
  if (!correctionForm.value.reason) {
    ElMessage.error('请输入冲正原因')
    return
  }
  if (!correctionForm.value.operator) {
    ElMessage.error('请输入操作员')
    return
  }

  const result = store.createCorrection({
    distributionId: currentDistribution.value.id,
    correctedQuantity: correctionForm.value.correctedQuantity,
    reason: correctionForm.value.reason,
    operator: correctionForm.value.operator
  })

  if (result.success) {
    ElMessage.success(result.message)
    correctionDialogVisible.value = false
  } else {
    ElMessage.error(result.message)
  }
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return

    if (form.value.quantity > currentAvailable.value) {
      ElMessage.error(`发放数量(${form.value.quantity})超过待发放数量(${currentAvailable.value})`)
      return
    }

    submitting.value = true
    const result = store.distributeMaterial({
      allocationId: form.value.allocationId,
      quantity: form.value.quantity,
      receiver: form.value.receiver,
      remark: form.value.remark
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
    allocationId: '',
    quantity: 1,
    receiver: '',
    remark: ''
  }
  formRef.value?.resetFields()
}

watch(() => form.value.allocationId, () => {
})

onMounted(() => {
  store.allocations.forEach(a => store.updateAllocationAvailable(a.id))
})
</script>

<style scoped>
.distribution-view {
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
