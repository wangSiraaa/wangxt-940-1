<template>
  <div class="inbound-view">
    <el-card class="form-card">
      <template #header>
        <div class="card-header">
          <span>物资入库</span>
          <el-tag type="info">志愿者录入物资</el-tag>
        </div>
      </template>
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="物资分类" prop="category">
              <el-select v-model="form.category" placeholder="请选择物资分类" style="width: 100%">
                <el-option label="食品" value="food" />
                <el-option label="衣物" value="clothing" />
                <el-option label="日用品" value="daily" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="物资名称" prop="materialName">
              <el-select
                v-model="form.materialId"
                filterable
                allow-create
                placeholder="选择或输入物资名称"
                style="width: 100%"
                @change="handleMaterialChange"
              >
                <el-option
                  v-for="m in filteredMaterials"
                  :key="m.id"
                  :label="m.name"
                  :value="m.id"
                >
                  {{ m.name }} ({{ m.unit }})
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="新物资名称" prop="materialName" v-if="!form.materialId">
              <el-input v-model="form.materialName" placeholder="请输入物资名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="单位" prop="unit">
              <el-input v-model="form.unit" placeholder="如：袋、桶、件、支" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="数量" prop="quantity">
              <el-input-number v-model="form.quantity" :min="1" :max="9999" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="保质期" prop="expireDate" v-if="form.category === 'food'">
              <el-date-picker
                v-model="form.expireDate"
                type="date"
                placeholder="选择保质期"
                style="width: 100%"
                :disabled-date="disabledDate"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="捐赠方" prop="donor">
              <el-input v-model="form.donor" placeholder="请输入捐赠方名称" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item>
          <el-button type="primary" @click="handleSubmit" :loading="submitting">
            入库
          </el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="list-card">
      <template #header>
        <div class="card-header">
          <span>入库记录</span>
          <div>
            <el-input
              v-model="searchKeyword"
              placeholder="搜索物资名称/批次号/捐赠方"
              style="width: 250px; margin-right: 10px"
              clearable
            />
            <el-select v-model="filterCategory" placeholder="分类筛选" style="width: 120px" clearable>
              <el-option label="食品" value="food" />
              <el-option label="衣物" value="clothing" />
              <el-option label="日用品" value="daily" />
            </el-select>
          </div>
        </div>
      </template>
      <el-table :data="filteredBatches" stripe style="width: 100%">
        <el-table-column prop="batchNo" label="批次号" width="180" />
        <el-table-column prop="materialName" label="物资名称" width="120" />
        <el-table-column prop="category" label="分类" width="80">
          <template #default="{ row }">
            <el-tag :type="getCategoryTagType(row.category)" size="small">
              {{ getCategoryName(row.category) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="数量" width="80" />
        <el-table-column prop="expireDate" label="保质期" width="120">
          <template #default="{ row }">
            <span>{{ formatDate(row.expireDate) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.isExpired" type="danger" size="small">已过期</el-tag>
            <el-tag v-else-if="row.isNearExpiry" type="warning" size="small">临期优先</el-tag>
            <el-tag v-else type="success" size="small">正常</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="donor" label="捐赠方" width="120" />
        <el-table-column prop="inboundDate" label="入库日期" width="120" />
        <el-table-column label="库存状态" width="180">
          <template #default="{ row }">
            <div class="stock-info">
              <span>可用: <b>{{ row.availableQuantity }}</b></span>
              <span>已分配: {{ row.allocatedQuantity }}</span>
              <span>已发放: {{ row.distributedQuantity }}</span>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { useMaterialStore } from '@/stores/material'
import { formatDate, isExpired } from '@/utils/date'
import type { MaterialCategory } from '@/types'

const store = useMaterialStore()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const searchKeyword = ref('')
const filterCategory = ref<MaterialCategory | ''>('')

interface InboundForm {
  category: MaterialCategory | ''
  materialId: string
  materialName: string
  unit: string
  quantity: number
  expireDate: string | null
  donor: string
}

const form = ref<InboundForm>({
  category: '',
  materialId: '',
  materialName: '',
  unit: '',
  quantity: 1,
  expireDate: null,
  donor: ''
})

const rules: FormRules = {
  category: [{ required: true, message: '请选择物资分类', trigger: 'change' }],
  materialName: [{ required: true, message: '请输入物资名称', trigger: 'blur' }],
  unit: [{ required: true, message: '请输入单位', trigger: 'blur' }],
  quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }],
  donor: [{ required: true, message: '请输入捐赠方', trigger: 'blur' }]
}

const filteredMaterials = computed(() => {
  if (!form.value.category) return []
  return store.materials.filter(m => m.category === form.value.category)
})

const filteredBatches = computed(() => {
  return store.batches
    .filter(b => {
      const matchKeyword = !searchKeyword.value ||
        b.materialName.includes(searchKeyword.value) ||
        b.batchNo.includes(searchKeyword.value) ||
        b.donor.includes(searchKeyword.value)
      const matchCategory = !filterCategory.value || b.category === filterCategory.value
      return matchKeyword && matchCategory
    })
    .sort((a, b) => b.inboundDate.localeCompare(a.inboundDate))
})

function disabledDate(_time: Date) {
  return false
}

function getCategoryName(category: MaterialCategory): string {
  const map: Record<MaterialCategory, string> = {
    food: '食品',
    clothing: '衣物',
    daily: '日用品'
  }
  return map[category]
}

function getCategoryTagType(category: MaterialCategory): 'success' | 'info' | 'warning' {
  const map: Record<MaterialCategory, 'success' | 'info' | 'warning'> = {
    food: 'success',
    clothing: 'info',
    daily: 'warning'
  }
  return map[category]
}

function handleMaterialChange(id: string) {
  const material = store.materials.find(m => m.id === id)
  if (material) {
    form.value.materialName = material.name
    form.value.unit = material.unit
  }
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return

    if (!form.value.category) {
      ElMessage.error('请选择物资分类')
      return
    }

    if (form.value.category === 'food' && !form.value.expireDate) {
      ElMessage.error('食品必须填写保质期')
      return
    }

    if (form.value.category === 'food' && form.value.expireDate && isExpired(form.value.expireDate)) {
      try {
        await ElMessageBox.confirm(
          '该食品已过期，过期食品不能入库！',
          '入库失败',
          { confirmButtonText: '确定', showCancelButton: false, type: 'error' }
        )
      } catch {
        return
      }
      return
    }

    submitting.value = true
    const result = store.inboundMaterial({
      materialId: form.value.materialId || undefined,
      materialName: form.value.materialName,
      category: form.value.category,
      unit: form.value.unit,
      quantity: form.value.quantity,
      expireDate: form.value.expireDate,
      donor: form.value.donor
    })
    submitting.value = false

    if (result.success) {
      if (result.data?.isNearExpiry) {
        ElMessage.warning(result.message)
      } else {
        ElMessage.success(result.message)
      }
      resetForm()
    } else {
      ElMessage.error(result.message)
    }
  })
}

function resetForm() {
  form.value = {
    category: '',
    materialId: '',
    materialName: '',
    unit: '',
    quantity: 1,
    expireDate: null,
    donor: ''
  }
  formRef.value?.resetFields()
}

onMounted(() => {
  store.refreshBatchStatus()
})
</script>

<style scoped>
.inbound-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stock-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}

.stock-info span {
  line-height: 1.4;
}
</style>
