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
  allocatedQuantity: number
  distributedQuantity: number
  availableQuantity: number
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

export type ViewType = 'inbound' | 'sorting' | 'distribution' | 'correction' | 'statistics'

export interface OperationResult<T = void> {
  success: boolean
  message: string
  data?: T
}
