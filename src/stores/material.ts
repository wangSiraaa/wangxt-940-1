import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Material,
  Batch,
  Project,
  AllocationRecord,
  DistributionRecord,
  CorrectionRecord,
  MaterialCategory,
  OperationResult
} from '@/types'
import { generateId, generateBatchNo } from '@/utils/id'
import { isExpired, isNearExpiry, today } from '@/utils/date'

const STORAGE_KEY = 'donation_material_data'

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(key)
    if (data) {
      return JSON.parse(data)
    }
  } catch (e) {
    console.error('Failed to load from storage:', e)
  }
  return defaultValue
}

function saveToStorage(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (e) {
    console.error('Failed to save to storage:', e)
  }
}

export const useMaterialStore = defineStore('material', () => {
  const materials = ref<Material[]>(loadFromStorage(`${STORAGE_KEY}_materials`, []))
  const batches = ref<Batch[]>(loadFromStorage(`${STORAGE_KEY}_batches`, []))
  const projects = ref<Project[]>(loadFromStorage(`${STORAGE_KEY}_projects`, []))
  const allocations = ref<AllocationRecord[]>(loadFromStorage(`${STORAGE_KEY}_allocations`, []))
  const distributions = ref<DistributionRecord[]>(loadFromStorage(`${STORAGE_KEY}_distributions`, []))
  const corrections = ref<CorrectionRecord[]>(loadFromStorage(`${STORAGE_KEY}_corrections`, []))

  function persistAll() {
    saveToStorage(`${STORAGE_KEY}_materials`, materials.value)
    saveToStorage(`${STORAGE_KEY}_batches`, batches.value)
    saveToStorage(`${STORAGE_KEY}_projects`, projects.value)
    saveToStorage(`${STORAGE_KEY}_allocations`, allocations.value)
    saveToStorage(`${STORAGE_KEY}_distributions`, distributions.value)
    saveToStorage(`${STORAGE_KEY}_corrections`, corrections.value)
  }

  function refreshBatchStatus() {
    batches.value.forEach(batch => {
      batch.isExpired = isExpired(batch.expireDate)
      batch.isNearExpiry = isNearExpiry(batch.expireDate)
    })
  }

  function updateBatchAvailable(batchId: string) {
    const batch = batches.value.find(b => b.id === batchId)
    if (batch) {
      batch.allocatedQuantity = allocations.value
        .filter(a => a.batchId === batchId && a.status !== 'cancelled')
        .reduce((sum, a) => sum + a.quantity, 0)
      batch.distributedQuantity = distributions.value
        .filter(d => d.batchId === batchId)
        .reduce((sum, d) => sum + d.quantity, 0)
      batch.availableQuantity = batch.quantity - batch.allocatedQuantity
    }
  }

  function updateAllocationAvailable(allocationId: string) {
    const allocation = allocations.value.find(a => a.id === allocationId)
    if (allocation) {
      allocation.distributedQuantity = distributions.value
        .filter(d => d.allocationId === allocationId)
        .reduce((sum, d) => sum + d.quantity, 0)
      allocation.availableQuantity = allocation.quantity - allocation.distributedQuantity
      if (allocation.distributedQuantity === 0) {
        allocation.status = 'pending'
      } else if (allocation.distributedQuantity < allocation.quantity) {
        allocation.status = 'partial'
      } else {
        allocation.status = 'completed'
      }
    }
  }

  const availableBatches = computed(() => {
    return batches.value
      .filter(b => !b.isExpired && b.availableQuantity > 0)
      .sort((a, b) => {
        if (a.isNearExpiry !== b.isNearExpiry) return a.isNearExpiry ? -1 : 1
        if (a.expireDate && b.expireDate) return a.expireDate.localeCompare(b.expireDate)
        return 0
      })
  })

  const activeProjects = computed(() => {
    return projects.value.filter(p => p.status === 'active')
  })

  const categoryStats = computed(() => {
    const stats: Record<MaterialCategory, { total: number; allocated: number; distributed: number; available: number }> = {
      food: { total: 0, allocated: 0, distributed: 0, available: 0 },
      clothing: { total: 0, allocated: 0, distributed: 0, available: 0 },
      daily: { total: 0, allocated: 0, distributed: 0, available: 0 }
    }
    batches.value.forEach(batch => {
      stats[batch.category].total += batch.quantity
      stats[batch.category].allocated += batch.allocatedQuantity
      stats[batch.category].distributed += batch.distributedQuantity
      stats[batch.category].available += batch.availableQuantity
    })
    return stats
  })

  function inboundMaterial(data: {
    materialId?: string
    materialName: string
    category: MaterialCategory
    unit: string
    quantity: number
    expireDate: string | null
    donor: string
  }): OperationResult<Batch> {
    refreshBatchStatus()

    if (data.category === 'food' && data.expireDate && isExpired(data.expireDate)) {
      return { success: false, message: '过期食品不能入库' }
    }

    if (data.quantity <= 0) {
      return { success: false, message: '入库数量必须大于0' }
    }

    let material = materials.value.find(m => m.id === data.materialId)
    if (!material) {
      material = {
        id: generateId('M'),
        name: data.materialName,
        category: data.category,
        unit: data.unit
      }
      materials.value.push(material)
    }

    const nearExpiry = data.category === 'food' && data.expireDate ? isNearExpiry(data.expireDate) : false

    const batch: Batch = {
      id: generateId('B'),
      materialId: material.id,
      materialName: material.name,
      category: data.category,
      quantity: data.quantity,
      expireDate: data.expireDate,
      donor: data.donor,
      batchNo: generateBatchNo(data.category),
      inboundDate: today(),
      isNearExpiry: nearExpiry,
      isExpired: false,
      allocatedQuantity: 0,
      distributedQuantity: 0,
      availableQuantity: data.quantity
    }

    batches.value.push(batch)
    persistAll()

    const message = nearExpiry
      ? `入库成功，该批次为临期食品，已标记优先发放`
      : '入库成功'

    return { success: true, message, data: batch }
  }

  function allocateMaterial(data: {
    projectId: string
    batchId: string
    quantity: number
    operator: string
  }): OperationResult<AllocationRecord> {
    refreshBatchStatus()

    const batch = batches.value.find(b => b.id === data.batchId)
    if (!batch) {
      return { success: false, message: '批次不存在' }
    }

    if (batch.isExpired) {
      return { success: false, message: '该批次已过期，不能分配' }
    }

    if (data.quantity <= 0) {
      return { success: false, message: '分配数量必须大于0' }
    }

    updateBatchAvailable(data.batchId)

    if (data.quantity > batch.availableQuantity) {
      return {
        success: false,
        message: `分配数量(${data.quantity})超过当前可用库存(${batch.availableQuantity})`
      }
    }

    const project = projects.value.find(p => p.id === data.projectId)
    if (!project) {
      return { success: false, message: '项目不存在' }
    }

    if (project.status !== 'active') {
      return { success: false, message: '项目未激活，不能分配' }
    }

    const allocation: AllocationRecord = {
      id: generateId('A'),
      projectId: data.projectId,
      projectName: project.name,
      batchId: data.batchId,
      batchNo: batch.batchNo,
      materialId: batch.materialId,
      materialName: batch.materialName,
      category: batch.category,
      quantity: data.quantity,
      distributedQuantity: 0,
      availableQuantity: data.quantity,
      status: 'pending',
      createDate: today(),
      operator: data.operator
    }

    allocations.value.push(allocation)
    updateBatchAvailable(data.batchId)
    persistAll()

    return { success: true, message: '分配成功', data: allocation }
  }

  function distributeMaterial(data: {
    allocationId: string
    quantity: number
    receiver: string
    remark: string
  }): OperationResult<DistributionRecord> {
    const allocation = allocations.value.find(a => a.id === data.allocationId)
    if (!allocation) {
      return { success: false, message: '分配记录不存在' }
    }

    if (allocation.status === 'cancelled') {
      return { success: false, message: '该分配已取消，不能发放' }
    }

    if (data.quantity <= 0) {
      return { success: false, message: '发放数量必须大于0' }
    }

    updateAllocationAvailable(data.allocationId)

    if (data.quantity > allocation.availableQuantity) {
      return {
        success: false,
        message: `发放数量(${data.quantity})超过待发放数量(${allocation.availableQuantity})`
      }
    }

    const distribution: DistributionRecord = {
      id: generateId('D'),
      allocationId: data.allocationId,
      projectId: allocation.projectId,
      projectName: allocation.projectName,
      batchId: allocation.batchId,
      materialId: allocation.materialId,
      materialName: allocation.materialName,
      category: allocation.category,
      quantity: data.quantity,
      receiveDate: today(),
      receiver: data.receiver,
      remark: data.remark
    }

    distributions.value.push(distribution)
    updateAllocationAvailable(data.allocationId)
    updateBatchAvailable(allocation.batchId)
    persistAll()

    return { success: true, message: '发放成功', data: distribution }
  }

  function revokeDistribution(distributionId: string): OperationResult {
    return {
      success: false,
      message: '已发放物资不能撤回，只能登记冲正记录'
    }
  }

  function createCorrection(data: {
    distributionId: string
    correctedQuantity: number
    reason: string
    operator: string
  }): OperationResult<CorrectionRecord> {
    const distribution = distributions.value.find(d => d.id === data.distributionId)
    if (!distribution) {
      return { success: false, message: '发放记录不存在' }
    }

    if (data.correctedQuantity < 0) {
      return { success: false, message: '冲正数量不能为负数' }
    }

    if (data.correctedQuantity > distribution.quantity) {
      return {
        success: false,
        message: `冲正数量(${data.correctedQuantity})不能超过原发放数量(${distribution.quantity})`
      }
    }

    const existingCorrection = corrections.value.find(c => c.distributionId === data.distributionId)
    if (existingCorrection) {
      return { success: false, message: '该发放记录已存在冲正记录' }
    }

    const correction: CorrectionRecord = {
      id: generateId('C'),
      distributionId: data.distributionId,
      projectId: distribution.projectId,
      projectName: distribution.projectName,
      materialName: distribution.materialName,
      originalQuantity: distribution.quantity,
      correctedQuantity: data.correctedQuantity,
      reason: data.reason,
      createDate: today(),
      operator: data.operator
    }

    corrections.value.push(correction)
    persistAll()

    return { success: true, message: '冲正记录登记成功', data: correction }
  }

  function cancelProject(projectId: string): OperationResult {
    const project = projects.value.find(p => p.id === projectId)
    if (!project) {
      return { success: false, message: '项目不存在' }
    }

    if (project.status !== 'active') {
      return { success: false, message: '项目状态不正确' }
    }

    const projectAllocations = allocations.value.filter(
      a => a.projectId === projectId && a.status !== 'cancelled'
    )

    projectAllocations.forEach(allocation => {
      if (allocation.status !== 'completed') {
        allocation.status = 'cancelled'
        updateBatchAvailable(allocation.batchId)
      }
    })

    project.status = 'cancelled'
    persistAll()

    return { success: true, message: '项目已取消，未发放数量已退回库存' }
  }

  function addProject(data: {
    name: string
    description: string
  }): OperationResult<Project> {
    const existing = projects.value.find(p => p.name === data.name && p.status === 'active')
    if (existing) {
      return { success: false, message: '已存在同名的活跃项目' }
    }

    const project: Project = {
      id: generateId('P'),
      name: data.name,
      description: data.description,
      status: 'active',
      createDate: today()
    }

    projects.value.push(project)
    persistAll()

    return { success: true, message: '项目创建成功', data: project }
  }

  function initMockData() {
    if (materials.value.length === 0) {
      const mockMaterials: Material[] = [
        { id: 'M1', name: '大米', category: 'food', unit: '袋' },
        { id: 'M2', name: '食用油', category: 'food', unit: '桶' },
        { id: 'M3', name: '饼干', category: 'food', unit: '箱' },
        { id: 'M4', name: '羽绒服', category: 'clothing', unit: '件' },
        { id: 'M5', name: '毛衣', category: 'clothing', unit: '件' },
        { id: 'M6', name: '牙膏', category: 'daily', unit: '支' },
        { id: 'M7', name: '毛巾', category: 'daily', unit: '条' }
      ]
      materials.value = mockMaterials

      const mockProjects: Project[] = [
        { id: 'P1', name: '山区学校帮扶', description: '为山区学校提供生活物资', status: 'active', createDate: '2026-01-01' },
        { id: 'P2', name: '敬老院慰问', description: '为敬老院老人提供生活物资', status: 'active', createDate: '2026-01-15' },
        { id: 'P3', name: '灾区援助', description: '为受灾地区提供应急物资', status: 'active', createDate: '2026-02-01' }
      ]
      projects.value = mockProjects

      const futureDate1 = new Date()
      futureDate1.setDate(futureDate1.getDate() + 15)
      const futureDate2 = new Date()
      futureDate2.setDate(futureDate2.getDate() + 60)
      const futureDate3 = new Date()
      futureDate3.setDate(futureDate3.getDate() + 180)

      const mockBatches: Batch[] = [
        {
          id: 'B1',
          materialId: 'M1',
          materialName: '大米',
          category: 'food',
          quantity: 100,
          expireDate: futureDate1.toISOString().split('T')[0],
          donor: '爱心企业A',
          batchNo: 'SP202606010001',
          inboundDate: '2026-06-01',
          isNearExpiry: true,
          isExpired: false,
          allocatedQuantity: 0,
          distributedQuantity: 0,
          availableQuantity: 100
        },
        {
          id: 'B2',
          materialId: 'M2',
          materialName: '食用油',
          category: 'food',
          quantity: 50,
          expireDate: futureDate2.toISOString().split('T')[0],
          donor: '爱心企业B',
          batchNo: 'SP202606050002',
          inboundDate: '2026-06-05',
          isNearExpiry: false,
          isExpired: false,
          allocatedQuantity: 0,
          distributedQuantity: 0,
          availableQuantity: 50
        },
        {
          id: 'B3',
          materialId: 'M4',
          materialName: '羽绒服',
          category: 'clothing',
          quantity: 200,
          expireDate: null,
          donor: '爱心人士C',
          batchNo: 'YZ202606100003',
          inboundDate: '2026-06-10',
          isNearExpiry: false,
          isExpired: false,
          allocatedQuantity: 0,
          distributedQuantity: 0,
          availableQuantity: 200
        },
        {
          id: 'B4',
          materialId: 'M6',
          materialName: '牙膏',
          category: 'daily',
          quantity: 300,
          expireDate: futureDate3.toISOString().split('T')[0],
          donor: '超市D',
          batchNo: 'RY202606080004',
          inboundDate: '2026-06-08',
          isNearExpiry: false,
          isExpired: false,
          allocatedQuantity: 0,
          distributedQuantity: 0,
          availableQuantity: 300
        }
      ]
      batches.value = mockBatches
      persistAll()
    }
  }

  function clearAllData() {
    materials.value = []
    batches.value = []
    projects.value = []
    allocations.value = []
    distributions.value = []
    corrections.value = []
    persistAll()
  }

  return {
    materials,
    batches,
    projects,
    allocations,
    distributions,
    corrections,
    availableBatches,
    activeProjects,
    categoryStats,
    inboundMaterial,
    allocateMaterial,
    distributeMaterial,
    revokeDistribution,
    createCorrection,
    cancelProject,
    addProject,
    initMockData,
    clearAllData,
    refreshBatchStatus,
    updateBatchAvailable,
    updateAllocationAvailable
  }
})
