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
  OperationResult,
  RecallOrder,
  TransferRecord,
  BatchTrace,
  RecallReason,
  RecallStatus
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
  const recalls = ref<RecallOrder[]>(loadFromStorage(`${STORAGE_KEY}_recalls`, []))
  const transfers = ref<TransferRecord[]>(loadFromStorage(`${STORAGE_KEY}_transfers`, []))
  const traces = ref<BatchTrace[]>(loadFromStorage(`${STORAGE_KEY}_traces`, []))

  function persistAll() {
    saveToStorage(`${STORAGE_KEY}_materials`, materials.value)
    saveToStorage(`${STORAGE_KEY}_batches`, batches.value)
    saveToStorage(`${STORAGE_KEY}_projects`, projects.value)
    saveToStorage(`${STORAGE_KEY}_allocations`, allocations.value)
    saveToStorage(`${STORAGE_KEY}_distributions`, distributions.value)
    saveToStorage(`${STORAGE_KEY}_corrections`, corrections.value)
    saveToStorage(`${STORAGE_KEY}_recalls`, recalls.value)
    saveToStorage(`${STORAGE_KEY}_transfers`, transfers.value)
    saveToStorage(`${STORAGE_KEY}_traces`, traces.value)
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
      .filter(b => !b.isExpired && !b.isRecalled && b.availableQuantity > 0)
      .sort((a, b) => {
        if (a.isNearExpiry !== b.isNearExpiry) return a.isNearExpiry ? -1 : 1
        if (a.expireDate && b.expireDate) return a.expireDate.localeCompare(b.expireDate)
        return 0
      })
  })

  const recalledBatches = computed(() => {
    return batches.value
      .filter(b => b.isRecalled)
      .sort((a, b) => b.inboundDate.localeCompare(a.inboundDate))
  })

  const pendingRecalls = computed(() => {
    return recalls.value
      .filter(r => r.status === 'pending' || r.status === 'confirmed' || r.status === 'processing')
      .sort((a, b) => b.createDate.localeCompare(a.createDate))
  })

  const recallStats = computed(() => {
    const stats = {
      total: recalls.value.length,
      pending: recalls.value.filter(r => r.status === 'pending').length,
      processing: recalls.value.filter(r => r.status === 'processing').length,
      completed: recalls.value.filter(r => r.status === 'completed').length,
      totalQuantity: recalls.value.reduce((sum, r) => sum + r.totalQuantity, 0),
      transferredQuantity: transfers.value.reduce((sum, t) => sum + t.quantity, 0),
      affectedBatches: new Set(recalls.value.map(r => r.batchId)).size
    }
    return stats
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
      isRecalled: false,
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

    if (batch.isRecalled) {
      const activeRecall = recalls.value.find(r => r.batchId === data.batchId && r.status !== 'completed' && r.status !== 'cancelled')
      if (activeRecall) {
        return { success: false, message: '该批次正在召回处理中，禁止继续分配' }
      }
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
        const batch = batches.value.find(b => b.id === allocation.batchId)
        if (batch) {
          const hasActiveRecall = recalls.value.some(r => r.batchId === allocation.batchId && r.status !== 'completed' && r.status !== 'cancelled')
          if (hasActiveRecall) {
            batch.isRecalled = true
          }
        }
      }
    })

    project.status = 'cancelled'
    persistAll()

    return { success: true, message: '项目已取消，未发放数量已退回库存，保留召回标记' }
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

  function createRecall(data: {
    batchId: string
    reason: RecallReason
    reasonDetail: string
    operator: string
    remark: string
  }): OperationResult<RecallOrder> {
    refreshBatchStatus()

    const batch = batches.value.find(b => b.id === data.batchId)
    if (!batch) {
      return { success: false, message: '批次不存在' }
    }

    if (batch.isExpired && data.reason !== 'other') {
      return { success: false, message: '过期食品仍不能入库，无法发起召回' }
    }

    if (data.reason === 'expired_misdeliver' && !isNearExpiry(batch.expireDate)) {
      return { success: false, message: '该批次食品未临期，无法以临期误发原因召回' }
    }

    if (data.reason === 'spec_error' && batch.category !== 'clothing') {
      return { success: false, message: '规格错误召回原因仅适用于衣物类物资' }
    }

    if (data.reason === 'donor_direction' && !batch.donor) {
      return { success: false, message: '该批次没有捐赠方信息，无法以捐赠方定向原因召回' }
    }

    const existingRecall = recalls.value.find(
      r => r.batchId === data.batchId && r.status !== 'completed' && r.status !== 'cancelled'
    )
    if (existingRecall) {
      return { success: false, message: '该批次已有正在处理的召回单' }
    }

    updateBatchAvailable(data.batchId)

    const distributedQuantity = distributions.value
      .filter(d => d.batchId === data.batchId)
      .reduce((sum, d) => sum + d.quantity, 0)

    const recall: RecallOrder = {
      id: generateId('R'),
      batchId: data.batchId,
      batchNo: batch.batchNo,
      materialId: batch.materialId,
      materialName: batch.materialName,
      category: batch.category,
      reason: data.reason,
      reasonDetail: data.reasonDetail,
      totalQuantity: batch.quantity,
      distributedQuantity: distributedQuantity,
      undistributedQuantity: batch.quantity - distributedQuantity,
      operator: data.operator,
      createDate: today(),
      confirmDate: null,
      confirmer: null,
      status: 'pending',
      remark: data.remark
    }

    recalls.value.push(recall)
    batch.isRecalled = true

    addTrace({
      recallId: recall.id,
      batchId: data.batchId,
      traceType: 'recall',
      projectId: null,
      projectName: null,
      quantity: batch.quantity,
      description: `发起召回：${getReasonName(data.reason)} - ${data.reasonDetail}`,
      operator: data.operator
    })

    persistAll()

    return { success: true, message: '召回单创建成功，等待项目负责人确认', data: recall }
  }

  function confirmRecall(data: {
    recallId: string
    confirmer: string
    distributedQuantity: number
    undistributedQuantity: number
    remark: string
  }): OperationResult<RecallOrder> {
    const recall = recalls.value.find(r => r.id === data.recallId)
    if (!recall) {
      return { success: false, message: '召回单不存在' }
    }

    if (recall.status !== 'pending') {
      return { success: false, message: '召回单状态不正确，无法确认' }
    }

    if (data.distributedQuantity + data.undistributedQuantity !== recall.totalQuantity) {
      return {
        success: false,
        message: `已发放数量(${data.distributedQuantity}) + 未发放数量(${data.undistributedQuantity})必须等于总数量(${recall.totalQuantity})`
      }
    }

    recall.status = 'confirmed'
    recall.confirmer = data.confirmer
    recall.confirmDate = today()
    recall.distributedQuantity = data.distributedQuantity
    recall.undistributedQuantity = data.undistributedQuantity
    recall.remark = data.remark

    addTrace({
      recallId: recall.id,
      batchId: recall.batchId,
      traceType: 'recall',
      projectId: null,
      projectName: null,
      quantity: 0,
      description: `召回确认：已发放${data.distributedQuantity}，未发放${data.undistributedQuantity}`,
      operator: data.confirmer
    })

    persistAll()

    return { success: true, message: '召回确认成功，可进行物资调剂', data: recall }
  }

  function startProcessingRecall(recallId: string, operator: string): OperationResult<RecallOrder> {
    const recall = recalls.value.find(r => r.id === recallId)
    if (!recall) {
      return { success: false, message: '召回单不存在' }
    }

    if (recall.status !== 'confirmed') {
      return { success: false, message: '召回单状态不正确，无法开始处理' }
    }

    recall.status = 'processing'

    addTrace({
      recallId: recall.id,
      batchId: recall.batchId,
      traceType: 'recall',
      projectId: null,
      projectName: null,
      quantity: 0,
      description: '开始召回处理',
      operator
    })

    persistAll()

    return { success: true, message: '已开始召回处理', data: recall }
  }

  function transferMaterial(data: {
    recallId: string
    sourceProjectId: string
    targetProjectId: string
    quantity: number
    operator: string
    remark: string
    allowOverTransfer?: boolean
    overTransferConfirmer?: string
  }): OperationResult<TransferRecord> {
    const recall = recalls.value.find(r => r.id === data.recallId)
    if (!recall) {
      return { success: false, message: '召回单不存在' }
    }

    if (recall.status !== 'confirmed' && recall.status !== 'processing') {
      return { success: false, message: '召回单状态不正确，无法进行调剂' }
    }

    if (data.sourceProjectId === data.targetProjectId) {
      return { success: false, message: '源项目和目标项目不能相同' }
    }

    const sourceProject = projects.value.find(p => p.id === data.sourceProjectId)
    if (!sourceProject) {
      return { success: false, message: '源项目不存在' }
    }

    const targetProject = projects.value.find(p => p.id === data.targetProjectId)
    if (!targetProject) {
      return { success: false, message: '目标项目不存在' }
    }

    if (targetProject.status !== 'active') {
      return { success: false, message: '目标项目未激活，不能调剂' }
    }

    if (data.quantity <= 0) {
      return { success: false, message: '调剂数量必须大于0' }
    }

    const sourceAllocation = allocations.value.find(
      a => a.projectId === data.sourceProjectId &&
           a.batchId === recall.batchId &&
           a.status !== 'cancelled'
    )

    if (!sourceAllocation) {
      return { success: false, message: '源项目没有该批次的分配记录' }
    }

    updateAllocationAvailable(sourceAllocation.id)

    const isOverTransfer = data.quantity > sourceAllocation.availableQuantity
    if (isOverTransfer && !data.allowOverTransfer) {
      return {
        success: false,
        message: `调剂数量超过可调剂数量，当前可调剂数量为${sourceAllocation.availableQuantity}，如需超量请勾选本地验收超量调剂`
      }
    }

    if (isOverTransfer && data.allowOverTransfer && !data.overTransferConfirmer) {
      return { success: false, message: '本地验收超量调剂需要项目负责人确认签字' }
    }

    const batch = batches.value.find(b => b.id === recall.batchId)
    if (batch && batch.isExpired) {
      return { success: false, message: '过期食品不能入库，无法调剂' }
    }

    if (isOverTransfer && batch) {
      const overQuantity = data.quantity - sourceAllocation.availableQuantity
      if (overQuantity > batch.availableQuantity) {
        return {
          success: false,
          message: `超量调剂数量(${overQuantity})超过批次可用库存(${batch.availableQuantity})，分配数量不能超过当前库存`
        }
      }
    }

    const transfer: TransferRecord = {
      id: generateId('T'),
      recallId: data.recallId,
      batchId: recall.batchId,
      batchNo: recall.batchNo,
      materialId: recall.materialId,
      materialName: recall.materialName,
      category: recall.category,
      sourceProjectId: data.sourceProjectId,
      sourceProjectName: sourceProject.name,
      targetProjectId: data.targetProjectId,
      targetProjectName: targetProject.name,
      quantity: data.quantity,
      operator: data.operator,
      createDate: today(),
      remark: data.remark
    }

    transfers.value.push(transfer)

    const deductFromSource = Math.min(data.quantity, sourceAllocation.availableQuantity)
    sourceAllocation.quantity -= deductFromSource
    sourceAllocation.availableQuantity -= deductFromSource
    if (sourceAllocation.quantity === 0) {
      sourceAllocation.status = 'cancelled'
    }

    if (isOverTransfer && batch) {
      const overQuantity = data.quantity - deductFromSource
      batch.allocatedQuantity += overQuantity
      batch.availableQuantity -= overQuantity
    }

    const targetAllocation = allocations.value.find(
      a => a.projectId === data.targetProjectId &&
           a.batchId === recall.batchId &&
           a.status !== 'cancelled'
    )

    if (targetAllocation) {
      targetAllocation.quantity += data.quantity
      targetAllocation.availableQuantity += data.quantity
      if (targetAllocation.status === 'completed') {
        targetAllocation.status = 'partial'
      }
    } else {
      const newAllocation: AllocationRecord = {
        id: generateId('A'),
        projectId: data.targetProjectId,
        projectName: targetProject.name,
        batchId: recall.batchId,
        batchNo: recall.batchNo,
        materialId: recall.materialId,
        materialName: recall.materialName,
        category: recall.category,
        quantity: data.quantity,
        distributedQuantity: 0,
        availableQuantity: data.quantity,
        status: 'pending',
        createDate: today(),
        operator: data.operator
      }
      allocations.value.push(newAllocation)
    }

    updateBatchAvailable(recall.batchId)

    const traceDesc = isOverTransfer
      ? `【超量调剂，负责人：${data.overTransferConfirmer}】从【${sourceProject.name}】调剂到【${targetProject.name}】，数量：${data.quantity}（其中${data.quantity - deductFromSource}件从库存直接调拨）`
      : `从【${sourceProject.name}】调剂到【${targetProject.name}】，数量：${data.quantity}`

    addTrace({
      recallId: data.recallId,
      batchId: recall.batchId,
      traceType: 'transfer',
      projectId: data.targetProjectId,
      projectName: targetProject.name,
      quantity: data.quantity,
      description: traceDesc,
      operator: data.operator
    })

    persistAll()

    return { success: true, message: '物资调剂成功', data: transfer }
  }

  function addDistributedTrack(data: {
    recallId: string
    distributionId: string
    projectId: string
    description: string
    operator: string
  }): OperationResult<BatchTrace> {
    const recall = recalls.value.find(r => r.id === data.recallId)
    if (!recall) {
      return { success: false, message: '召回单不存在' }
    }

    const distribution = distributions.value.find(d => d.id === data.distributionId)
    if (!distribution) {
      return { success: false, message: '发放记录不存在' }
    }

    const project = projects.value.find(p => p.id === data.projectId)
    if (!project) {
      return { success: false, message: '项目不存在' }
    }

    const trace = addTrace({
      recallId: data.recallId,
      batchId: recall.batchId,
      traceType: 'distributed_track',
      projectId: data.projectId,
      projectName: project.name,
      quantity: distribution.quantity,
      description: data.description,
      operator: data.operator
    })

    return { success: true, message: '已发放物资只能登记追踪说明和冲正记录，追踪登记成功', data: trace }
  }

  function completeRecall(recallId: string, operator: string): OperationResult<RecallOrder> {
    const recall = recalls.value.find(r => r.id === recallId)
    if (!recall) {
      return { success: false, message: '召回单不存在' }
    }

    if (recall.status !== 'processing') {
      return { success: false, message: '召回单状态不正确，无法完成' }
    }

    recall.status = 'completed'

    const batch = batches.value.find(b => b.id === recall.batchId)
    if (batch && batch.availableQuantity === 0) {
      batch.isRecalled = false
    }

    addTrace({
      recallId: recall.id,
      batchId: recall.batchId,
      traceType: 'recall',
      projectId: null,
      projectName: null,
      quantity: 0,
      description: '召回处理完成',
      operator
    })

    persistAll()

    return { success: true, message: '召回处理完成', data: recall }
  }

  function cancelRecall(recallId: string, operator: string): OperationResult<RecallOrder> {
    const recall = recalls.value.find(r => r.id === recallId)
    if (!recall) {
      return { success: false, message: '召回单不存在' }
    }

    if (recall.status === 'completed') {
      return { success: false, message: '已完成的召回单不能取消' }
    }

    if (recall.status === 'processing') {
      const hasTransfers = transfers.value.some(t => t.recallId === recallId)
      if (hasTransfers) {
        return { success: false, message: '该召回单已有调剂记录，无法取消' }
      }
    }

    recall.status = 'cancelled'

    const batch = batches.value.find(b => b.id === recall.batchId)
    if (batch) {
      const hasOtherActiveRecall = recalls.value.some(
        r => r.batchId === recall.batchId &&
             r.id !== recallId &&
             r.status !== 'completed' &&
             r.status !== 'cancelled'
      )
      if (!hasOtherActiveRecall) {
        batch.isRecalled = false
      }
    }

    addTrace({
      recallId: recall.id,
      batchId: recall.batchId,
      traceType: 'recall',
      projectId: null,
      projectName: null,
      quantity: 0,
      description: '取消召回',
      operator
    })

    persistAll()

    return { success: true, message: '召回已取消', data: recall }
  }

  function getBatchAllocations(batchId: string): AllocationRecord[] {
    return allocations.value.filter(
      a => a.batchId === batchId && a.status !== 'cancelled'
    )
  }

  function getBatchDistributions(batchId: string): DistributionRecord[] {
    return distributions.value
      .filter(d => d.batchId === batchId)
      .sort((a, b) => b.receiveDate.localeCompare(a.receiveDate))
  }

  function getBatchTraces(batchId: string): BatchTrace[] {
    return traces.value
      .filter(t => t.batchId === batchId)
      .sort((a, b) => b.createDate.localeCompare(a.createDate))
  }

  function getRecallTransfers(recallId: string): TransferRecord[] {
    return transfers.value
      .filter(t => t.recallId === recallId)
      .sort((a, b) => b.createDate.localeCompare(a.createDate))
  }

  function getRecallTraces(recallId: string): BatchTrace[] {
    return traces.value
      .filter(t => t.recallId === recallId)
      .sort((a, b) => b.createDate.localeCompare(a.createDate))
  }

  function addTrace(data: {
    recallId: string | null
    batchId: string
    traceType: 'recall' | 'distributed_track' | 'correction' | 'transfer'
    projectId: string | null
    projectName: string | null
    quantity: number
    description: string
    operator: string
  }): BatchTrace {
    const batch = batches.value.find(b => b.id === data.batchId)
    const trace: BatchTrace = {
      id: generateId('TR'),
      recallId: data.recallId,
      batchId: data.batchId,
      batchNo: batch?.batchNo || '',
      materialId: batch?.materialId || '',
      materialName: batch?.materialName || '',
      category: batch?.category || 'food',
      traceType: data.traceType,
      projectId: data.projectId,
      projectName: data.projectName,
      quantity: data.quantity,
      description: data.description,
      operator: data.operator,
      createDate: today()
    }
    traces.value.push(trace)
    return trace
  }

  function getReasonName(reason: RecallReason): string {
    const map: Record<RecallReason, string> = {
      expired_misdeliver: '临期误发',
      spec_error: '规格登记错误',
      donor_direction: '捐赠方要求定向',
      other: '其他原因'
    }
    return map[reason]
  }

  function getRecallStatusName(status: RecallStatus): string {
    const map: Record<RecallStatus, string> = {
      pending: '待确认',
      confirmed: '已确认',
      processing: '处理中',
      completed: '已完成',
      cancelled: '已取消'
    }
    return map[status]
  }

  function getTraceTypeName(type: string): string {
    const map: Record<string, string> = {
      recall: '召回操作',
      distributed_track: '已发放追踪',
      correction: '冲正记录',
      transfer: '物资调剂'
    }
    return map[type] || type
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
          isRecalled: false,
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
          isRecalled: false,
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
          isRecalled: false,
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
          isRecalled: false,
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
    recalls.value = []
    transfers.value = []
    traces.value = []
    persistAll()
  }

  return {
    materials,
    batches,
    projects,
    allocations,
    distributions,
    corrections,
    recalls,
    transfers,
    traces,
    availableBatches,
    recalledBatches,
    pendingRecalls,
    recallStats,
    activeProjects,
    categoryStats,
    inboundMaterial,
    allocateMaterial,
    distributeMaterial,
    revokeDistribution,
    createCorrection,
    cancelProject,
    addProject,
    createRecall,
    confirmRecall,
    startProcessingRecall,
    transferMaterial,
    addDistributedTrack,
    completeRecall,
    cancelRecall,
    getBatchAllocations,
    getBatchDistributions,
    getBatchTraces,
    getRecallTransfers,
    getRecallTraces,
    getReasonName,
    getRecallStatusName,
    getTraceTypeName,
    initMockData,
    clearAllData,
    refreshBatchStatus,
    updateBatchAvailable,
    updateAllocationAvailable,
    addTrace,
    persistAll
  }
})
