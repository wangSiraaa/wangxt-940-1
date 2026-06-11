<template>
  <div class="correction-view">
    <el-card class="list-card">
      <template #header>
        <div class="card-header">
          <span>冲正记录</span>
          <div class="header-actions">
            <el-button type="primary" @click="showCreateDialog">
              新建冲正记录
            </el-button>
          </div>
        </div>
      </template>
      <el-alert
        title="冲正说明"
        type="info"
        :closable="false"
        style="margin-bottom: 20px"
      >
        <p>已发放物资不能直接撤回，如需调整请登记冲正记录。</p>
        <p>冲正记录用于登记实际发放数量与原记录的差异，冲正数量为实际发放的正确数量。</p>
      </el-alert>
      <el-table :data="correctionsWithDetails" stripe style="width: 100%">
        <el-table-column prop="projectName" label="项目" width="140" />
        <el-table-column prop="materialName" label="物资" width="100" />
        <el-table-column prop="originalQuantity" label="原发放数量" width="120" />
        <el-table-column prop="correctedQuantity" label="冲正后数量" width="120">
          <template #default="{ row }">
            <b :style="{ color: row.correctedQuantity < row.originalQuantity ? '#f56c6c' : '#67c23a' }">
              {{ row.correctedQuantity }}
            </b>
          </template>
        </el-table-column>
        <el-table-column label="差异" width="100">
          <template #default="{ row }">
            <span :style="{ color: row.correctedQuantity < row.originalQuantity ? '#f56c6c' : '#67c23a' }">
              {{ row.correctedQuantity - row.originalQuantity > 0 ? '+' : '' }}
              {{ row.correctedQuantity - row.originalQuantity }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="冲正原因" min-width="200" show-overflow-tooltip />
        <el-table-column prop="operator" label="操作员" width="100" />
        <el-table-column prop="createDate" label="登记日期" width="120" />
      </el-table>
    </el-card>

    <el-card class="distributions-card">
      <template #header>
        <span>可冲正的发放记录</span>
      </template>
      <el-table :data="correctableDistributions" stripe style="width: 100%">
        <el-table-column prop="projectName" label="项目" width="140" />
        <el-table-column prop="materialName" label="物资" width="100" />
        <el-table-column prop="quantity" label="发放数量" width="100" />
        <el-table-column prop="receiver" label="领取人" width="100" />
        <el-table-column prop="receiveDate" label="领取日期" width="120" />
        <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button
              type="warning"
              size="small"
              @click="handleCreateFromDistribution(row)"
            >
              登记冲正
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="createDialogVisible"
      title="登记冲正记录"
      width="500px"
    >
      <el-form :model="correctionForm" :rules="rules" ref="formRef" label-width="120px">
        <el-form-item label="发放记录" prop="distributionId">
          <el-select
            v-model="correctionForm.distributionId"
            placeholder="请选择发放记录"
            style="width: 100%"
            @change="handleDistributionChange"
          >
            <el-option
              v-for="d in correctableDistributions"
              :key="d.id"
              :label="`${d.materialName} - ${d.projectName} - ${d.quantity}`"
              :value="d.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="原发放数量">
          <el-input :value="currentDistribution?.quantity" disabled />
        </el-form-item>
        <el-form-item label="冲正后数量" prop="correctedQuantity">
          <el-input-number
            v-model="correctionForm.correctedQuantity"
            :min="0"
            :max="currentDistribution?.quantity || 0"
            style="width: 100%"
          />
          <div class="tip">
            差异数量: <b :style="{ color: diffColor }">{{ diffQuantity > 0 ? '+' : '' }}{{ diffQuantity }}</b>
          </div>
        </el-form-item>
        <el-form-item label="冲正原因" prop="reason">
          <el-input
            v-model="correctionForm.reason"
            type="textarea"
            :rows="3"
            placeholder="请详细说明冲正原因"
          />
        </el-form-item>
        <el-form-item label="操作员" prop="operator">
          <el-input v-model="correctionForm.operator" placeholder="请输入操作员姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          确认登记
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useMaterialStore } from '@/stores/material'
import type { DistributionRecord } from '@/types'

const store = useMaterialStore()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const createDialogVisible = ref(false)
const currentDistribution = ref<DistributionRecord | null>(null)

const correctionForm = ref({
  distributionId: '',
  correctedQuantity: 0,
  reason: '',
  operator: ''
})

const rules: FormRules = {
  distributionId: [{ required: true, message: '请选择发放记录', trigger: 'change' }],
  correctedQuantity: [{ required: true, message: '请输入冲正后数量', trigger: 'blur' }],
  reason: [{ required: true, message: '请输入冲正原因', trigger: 'blur' }],
  operator: [{ required: true, message: '请输入操作员', trigger: 'blur' }]
}

const correctionsWithDetails = computed(() => {
  return [...store.corrections].sort((a, b) => b.createDate.localeCompare(a.createDate))
})

const correctableDistributions = computed(() => {
  return store.distributions.filter(d => {
    return !store.corrections.some(c => c.distributionId === d.id)
  }).sort((a, b) => b.receiveDate.localeCompare(a.receiveDate))
})

const diffQuantity = computed(() => {
  if (!currentDistribution.value) return 0
  return correctionForm.value.correctedQuantity - currentDistribution.value.quantity
})

const diffColor = computed(() => {
  return diffQuantity.value < 0 ? '#f56c6c' : '#67c23a'
})

function showCreateDialog() {
  correctionForm.value = {
    distributionId: '',
    correctedQuantity: 0,
    reason: '',
    operator: ''
  }
  currentDistribution.value = null
  createDialogVisible.value = true
}

function handleCreateFromDistribution(row: DistributionRecord) {
  currentDistribution.value = row
  correctionForm.value = {
    distributionId: row.id,
    correctedQuantity: row.quantity,
    reason: '',
    operator: ''
  }
  createDialogVisible.value = true
}

function handleDistributionChange(id: string) {
  const dist = store.distributions.find(d => d.id === id)
  if (dist) {
    currentDistribution.value = dist
    correctionForm.value.correctedQuantity = dist.quantity
  }
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return

    submitting.value = true
    const result = store.createCorrection({
      distributionId: correctionForm.value.distributionId,
      correctedQuantity: correctionForm.value.correctedQuantity,
      reason: correctionForm.value.reason,
      operator: correctionForm.value.operator
    })
    submitting.value = false

    if (result.success) {
      ElMessage.success(result.message)
      createDialogVisible.value = false
    } else {
      ElMessage.error(result.message)
    }
  })
}

onMounted(() => {
})
</script>

<style scoped>
.correction-view {
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
