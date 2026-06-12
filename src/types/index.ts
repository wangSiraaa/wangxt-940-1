export type MaterialCategory = 'food' | 'clothing' | 'daily'

export interface Material {
  id: string
  name: string
  category: MaterialCategory
  unit: string
}

export interface Batch {
  id: string
  materialId: string
  materialName: string
  category: MaterialCategory
  quantity: number
  expireDate: string | null
  donor: string
  batchNo: string
  inboundDate: string
  isNearExpiry: boolean
  isExpired: boolean
  isRecalled: boolean
  allocatedQuantity: number
  distributedQuantity: number
  availableQuantity: number
}

export type RecallReason = 'expired_misdeliver' | 'spec_error' | 'donor_direction' | 'other'
export type RecallStatus = 'pending' | 'confirmed' | 'processing' | 'completed' | 'cancelled'

export interface RecallOrder {
  id: string
  batchId: string
  batchNo: string
  materialId: string
  materialName: string
  category: MaterialCategory
  reason: RecallReason
  reasonDetail: string
  totalQuantity: number
  distributedQuantity: number
  undistributedQuantity: number
  operator: string
  createDate: string
  confirmDate: string | null
  confirmer: string | null
  status: RecallStatus
  remark: string
}

export interface TransferRecord {
  id: string
  recallId: string
  batchId: string
  batchNo: string
  materialId: string
  materialName: string
  category: MaterialCategory
  sourceProjectId: string
  sourceProjectName: string
  targetProjectId: string
  targetProjectName: string
  quantity: number
  operator: string
  createDate: string
  remark: string
}

export interface BatchTrace {
  id: string
  recallId: string | null
  batchId: string
  batchNo: string
  materialId: string
  materialName: string
  category: MaterialCategory
  traceType: 'recall' | 'distributed_track' | 'correction' | 'transfer'
  projectId: string | null
  projectName: string | null
  quantity: number
  description: string
  operator: string
  createDate: string
}

export interface Project {
  id: string
  name: string
  description: string
  status: 'active' | 'completed' | 'cancelled'
  createDate: string
}

export interface AllocationRecord {
  id: string
  projectId: string
  projectName: string
  batchId: string
  batchNo: string
  materialId: string
  materialName: string
  category: MaterialCategory
  quantity: number
  distributedQuantity: number
  availableQuantity: number
  status: 'pending' | 'partial' | 'completed' | 'cancelled'
  createDate: string
  operator: string
}

export interface DistributionRecord {
  id: string
  allocationId: string
  projectId: string
  projectName: string
  batchId: string
  materialId: string
  materialName: string
  category: MaterialCategory
  quantity: number
  receiveDate: string
  receiver: string
  remark: string
}

export interface CorrectionRecord {
  id: string
  distributionId: string
  projectId: string
  projectName: string
  materialName: string
  originalQuantity: number
  correctedQuantity: number
  reason: string
  createDate: string
  operator: string
}

export type ViewType = 'inbound' | 'sorting' | 'distribution' | 'correction' | 'statistics' | 'recall'

export interface OperationResult<T = void> {
  success: boolean
  message: string
  data?: T
}
