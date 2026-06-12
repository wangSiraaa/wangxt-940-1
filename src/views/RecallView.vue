<template>
  <div class="recall-view">
    <el-card class="stats-card">
      <el-row :gutter="20">
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-value">{{ store.recallStats.total }}</div>
            <div class="stat-label">召回单总数</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-value warning">{{ store.recallStats.pending + store.recallStats.processing }}</div>
            <div class="stat-label">处理中</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-value success">{{ store.recallStats.completed }}</div>
            <div class="stat-label">已完成</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-value info">{{ store.recallStats.transferredQuantity }}</div>
            <div class="stat-label">已调剂数量</div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card class="main-card">
      <el-tabs v-model="activeTab" type="card">
        <el-tab-pane label="召回单管理" name="recall">
          <div class="tab-content">
            <el-row :gutter="20">
              <el-col :span="8">
                <el-button type="primary" @click="showCreateDialog = true" :disabled="store.batches.filter(b => !b.isExpired && !b.isRecalled).length === 0">
                  <el-icon><Plus /></el-icon>
                  发起召回
                </el-button>
                <el-tag type="warning" style="margin-left: 10px">
                  召回中禁止再分配
                </el-tag>
              </el-col>
              <el-col :span="8">
                <el-input
                  v-model="searchKeyword"
                  placeholder="搜索批次号或物资名称"
                  clearable
                  style="width: 100%"
                >
                  <template #prefix>
                    <el-icon><Search /></el-icon>
                  </template>
                </el-input>
              </el-col>
              <el-col :span="8">
                <el-select v-model="filterStatus" placeholder="状态筛选" clearable style="width: 100%">
                  <el-option label="待确认" value="pending" />
                  <el-option label="已确认" value="confirmed" />
                  <el-option label="处理中" value="processing" />
                  <el-option label="已完成" value="completed" />
                  <el-option label="已取消" value="cancelled" />
                </el-select>
              </el-col>
            </el-row>

            <el-table :data="filteredRecalls" stripe style="width: 100%; margin-top: 20px">
              <el-table-column prop="batchNo" label="批次号" width="160" />
              <el-table-column prop="materialName" label="物资" width="100" />
              <el-table-column label="召回原因" width="120">
                <template #default="{ row }">
                  {{ store.getReasonName(row.reason) }}
                </template>
              </el-table-column>
              <el-table-column prop="totalQuantity" label="总数量" width="90" />
              <el-table-column prop="distributedQuantity" label="已发放" width="90" />
              <el-table-column prop="undistributedQuantity" label="未发放" width="90" />
              <el-table-column label="状态" width="100">
                <template #default="{ row }">
                  <el-tag :type="getRecallStatusTagType(row.status)" size="small">
                    {{ store.getRecallStatusName(row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="operator" label="发起人" width="90" />
              <el-table-column prop="createDate" label="发起日期" width="120" />
              <el-table-column label="操作" width="280" fixed="right">
                <template #default="{ row }">
                  <el-button
                    v-if="row.status === 'pending'"
                    type="primary"
                    size="small"
                    @click="openConfirmDialog(row)"
                  >
                    确认
                  </el-button>
                  <el-button
                    v-if="row.status === 'confirmed'"
                    type="success"
                    size="small"
                    @click="handleStartProcessing(row)"
                  >
                    开始处理
                  </el-button>
                  <el-button
                    v-if="row.status === 'processing'"
                    type="success"
                    size="small"
                    @click="handleComplete(row)"
                  >
                    完成
                  </el-button>
                  <el-button
                    v-if="row.status !== 'completed' && row.status !== 'cancelled'"
                    type="info"
                    size="small"
                    @click="openDetailDialog(row)"
                  >
                    详情
                  </el-button>
                  <el-button
                    v-if="row.status !== 'completed'"
                    type="danger"
                    size="small"
                    @click="handleCancel(row)"
                  >
                    取消
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <el-tab-pane label="项目调剂" name="transfer">
          <div class="tab-content">
            <el-alert
              title="业务规则"
              type="info"
              :closable="false"
              style="margin-bottom: 20px"
            >
              <ul>
                <li>未发放物资可转入其他项目</li>
                <li>调剂数量不能超过源项目未发放数量</li>
                <li>已发放不可撤回，只能登记追踪说明和冲正记录</li>
                <li>过期食品不能入库，无法调剂</li>
                <li>本地验收超量调剂需要项目负责人确认</li>
                <li>召回中禁止再分配，处理完成后可继续分配</li>
              </ul>
            </el-alert>

            <el-row :gutter="20">
              <el-col :span="12">
                <el-card>
                  <template #header>
                    <div class="card-header">
                      <span>物资调剂</span>
                      <el-tag type="warning" size="small">选择召回单后操作</el-tag>
                    </div>
                  </template>
                  <el-form :model="transferForm" :rules="transferRules" ref="transferFormRef" label-width="100px">
                    <el-form-item label="召回单" prop="recallId">
                      <el-select
                        v-model="transferForm.recallId"
                        placeholder="请选择召回单"
                        style="width: 100%"
                        @change="handleRecallChange"
                      >
                        <el-option
                          v-for="r in transferableRecalls"
                          :key="r.id"
                          :label="`${r.batchNo} - ${r.materialName}`"
                          :value="r.id"
                        />
                      </el-select>
                    </el-form-item>
                    <el-form-item label="源项目" prop="sourceProjectId">
                      <el-select
                        v-model="transferForm.sourceProjectId"
                        placeholder="请选择源项目"
                        style="width: 100%"
                        :disabled="!transferForm.recallId"
                      >
                        <el-option
                          v-for="a in sourceAllocations"
                          :key="a.projectId"
                          :label="`${a.projectName} (可调剂:${a.availableQuantity})`"
                          :value="a.projectId"
                        />
                      </el-select>
                    </el-form-item>
                    <el-form-item label="目标项目" prop="targetProjectId">
                      <el-select
                        v-model="transferForm.targetProjectId"
                        placeholder="请选择目标项目"
                        style="width: 100%"
                        :disabled="!transferForm.recallId"
                      >
                        <el-option
                          v-for="p in availableTargetProjects"
                          :key="p.id"
                          :label="p.name"
                          :value="p.id"
                        />
                      </el-select>
                    </el-form-item>
                    <el-form-item label="调剂数量" prop="quantity">
                      <el-input-number
                        v-model="transferForm.quantity"
                        :min="1"
                        :max="currentSourceAllocation ? Math.max(1, currentSourceAllocation.availableQuantity + (allowOverTransfer ? 50 : 0)) : 1"
                        style="width: 100%"
                      />
                      <div class="tip" v-if="currentSourceAllocation">
                        可调剂数量: <b>{{ currentSourceAllocation.availableQuantity }}</b>
                        <span v-if="isOverTransfer && !allowOverTransfer" style="color: #f56c6c; margin-left: 10px">
                          ⚠ 超量调剂需要项目负责人确认
                        </span>
                        <span v-else-if="isOverTransfer && allowOverTransfer" style="color: #e6a23c; margin-left: 10px">
                          ⚠ 已开启本地验收超量调剂
                        </span>
                      </div>
                    </el-form-item>
                    <el-form-item v-if="isOverTransfer" label="超量调剂" prop="allowOverTransfer">
                      <el-checkbox v-model="transferForm.allowOverTransfer">
                        本地验收超量调剂（需要项目负责人确认）
                      </el-checkbox>
                    </el-form-item>
                    <el-form-item v-if="isOverTransfer" label="负责人确认" prop="overTransferConfirmer">
                      <el-input
                        v-model="transferForm.overTransferConfirmer"
                        placeholder="请输入项目负责人姓名进行确认"
                      />
                    </el-form-item>
                    <el-form-item label="操作员" prop="operator">
                      <el-input v-model="transferForm.operator" placeholder="请输入操作员姓名" />
                    </el-form-item>
                    <el-form-item label="备注" prop="remark">
                      <el-input
                        v-model="transferForm.remark"
                        type="textarea"
                        :rows="2"
                        placeholder="请输入备注信息（可选）"
                      />
                    </el-form-item>
                    <el-form-item>
                      <el-button type="primary" @click="handleTransfer" :loading="transferring">
                        确认调剂
                      </el-button>
                      <el-button @click="resetTransferForm">重置</el-button>
                    </el-form-item>
                  </el-form>
                </el-card>
              </el-col>
              <el-col :span="12">
                <el-card>
                  <template #header>
                    <span>调剂记录</span>
                  </template>
                  <el-table :data="store.transfers" stripe style="width: 100%" max-height="500">
                    <el-table-column prop="batchNo" label="批次号" width="140" />
                    <el-table-column prop="materialName" label="物资" width="80" />
                    <el-table-column prop="sourceProjectName" label="源项目" width="120" show-overflow-tooltip />
                    <el-table-column prop="targetProjectName" label="目标项目" width="120" show-overflow-tooltip />
                    <el-table-column prop="quantity" label="数量" width="80" />
                    <el-table-column prop="operator" label="操作员" width="80" />
                    <el-table-column prop="createDate" label="日期" width="100" />
                    <el-table-column prop="remark" label="备注" min-width="100" show-overflow-tooltip />
                  </el-table>
                </el-card>
              </el-col>
            </el-row>
          </div>
        </el-tab-pane>

        <el-tab-pane label="批次追踪" name="trace">
          <div class="tab-content">
            <el-row :gutter="20">
              <el-col :span="8">
                <el-card>
                  <template #header>
                    <span>选择批次</span>
                  </template>
                  <el-select
                    v-model="selectedBatchId"
                    placeholder="请选择要追踪的批次"
                    style="width: 100%"
                    filterable
                  >
                    <el-option
                      v-for="b in store.batches"
                      :key="b.id"
                      :label="`${b.batchNo} - ${b.materialName}`"
                      :value="b.id"
                    >
                      <span style="float: left">{{ b.batchNo }} - {{ b.materialName }}</span>
                      <span style="float: right; color: #8492a6; font-size: 13px">
                        <el-tag v-if="b.isRecalled" type="danger" size="small">召回中</el-tag>
                        <el-tag v-if="b.isExpired" type="danger" size="small">已过期</el-tag>
                      </span>
                    </el-option>
                  </el-select>

                  <div v-if="selectedBatch" class="batch-info">
                    <h4>批次信息</h4>
                    <p><b>批次号:</b> {{ selectedBatch.batchNo }}</p>
                    <p><b>物资:</b> {{ selectedBatch.materialName }}</p>
                    <p><b>总数量:</b> {{ selectedBatch.quantity }}</p>
                    <p><b>已分配:</b> {{ selectedBatch.allocatedQuantity }}</p>
                    <p><b>已发放:</b> {{ selectedBatch.distributedQuantity }}</p>
                    <p><b>可用库存:</b> {{ selectedBatch.availableQuantity }}</p>
                    <p>
                      <b>状态:</b>
                      <el-tag v-if="selectedBatch.isRecalled" type="danger" size="small">召回中</el-tag>
                      <el-tag v-else-if="selectedBatch.isExpired" type="danger" size="small">已过期</el-tag>
                      <el-tag v-else type="success" size="small">正常</el-tag>
                    </p>
                  </div>

                  <div v-if="selectedBatch && selectedBatchId" class="batch-actions">
                    <el-button
                      type="primary"
                      size="small"
                      @click="showTrackDialog = true"
                      :disabled="store.getBatchDistributions(selectedBatchId).length === 0"
                    >
                      登记已发放追踪
                    </el-button>
                    <el-button
                      type="warning"
                      size="small"
                      @click="showCorrectionDialog = true"
                      :disabled="store.getBatchDistributions(selectedBatchId).length === 0"
                    >
                      登记冲正记录
                    </el-button>
                  </div>
                </el-card>
              </el-col>
              <el-col :span="16">
                <el-card>
                  <template #header>
                    <div class="card-header">
                      <span>追踪记录</span>
                      <el-tag v-if="selectedBatch" type="info" size="small">
                        共 {{ store.getBatchTraces(selectedBatchId || '').length }} 条记录
                      </el-tag>
                    </div>
                  </template>
                  <el-table
                    :data="selectedBatchId ? store.getBatchTraces(selectedBatchId) : []"
                    stripe
                    style="width: 100%"
                    max-height="600"
                  >
                    <el-table-column label="类型" width="110">
                      <template #default="{ row }">
                        <el-tag :type="getTraceTagType(row.traceType)" size="small">
                          {{ store.getTraceTypeName(row.traceType) }}
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column prop="projectName" label="项目" width="120" show-overflow-tooltip />
                    <el-table-column prop="quantity" label="数量" width="80" />
                    <el-table-column prop="description" label="操作说明" min-width="200" show-overflow-tooltip />
                    <el-table-column prop="operator" label="操作员" width="80" />
                    <el-table-column prop="createDate" label="时间" width="160" />
                  </el-table>
                  <el-empty v-if="!selectedBatchId" description="请选择批次查看追踪记录" />
                </el-card>
              </el-col>
            </el-row>
          </div>
        </el-tab-pane>

        <el-tab-pane label="统计影响" name="statistics">
          <div class="tab-content">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-card>
                  <template #header>
                    <span>召回影响统计</span>
                  </template>
                  <el-table :data="recallImpactList" stripe style="width: 100%">
                    <el-table-column prop="batchNo" label="批次号" width="160" />
                    <el-table-column prop="materialName" label="物资" width="100" />
                    <el-table-column prop="totalQuantity" label="总数量" width="90" />
                    <el-table-column prop="distributedQuantity" label="已发放" width="90" />
                    <el-table-column prop="transferredQuantity" label="已调剂" width="90" />
                    <el-table-column prop="affectedProjects" label="影响项目" width="100" />
                    <el-table-column label="状态" width="100">
                      <template #default="{ row }">
                        <el-tag :type="getRecallStatusTagType(row.status)" size="small">
                          {{ store.getRecallStatusName(row.status) }}
                        </el-tag>
                      </template>
                    </el-table-column>
                  </el-table>
                </el-card>
              </el-col>
              <el-col :span="12">
                <el-card>
                  <template #header>
                    <span>项目受影响情况</span>
                  </template>
                  <el-table :data="projectImpactList" stripe style="width: 100%">
                    <el-table-column prop="projectName" label="项目名称" width="180" />
                    <el-table-column prop="affectedBatches" label="涉及批次" width="100" />
                    <el-table-column prop="totalQuantity" label="涉及数量" width="100" />
                    <el-table-column prop="receivedQuantity" label="调入数量" width="100" />
                    <el-table-column prop="sentQuantity" label="调出数量" width="100" />
                  </el-table>
                </el-card>
              </el-col>
            </el-row>

            <el-card style="margin-top: 20px">
              <template #header>
                <span>分类召回统计</span>
              </template>
              <el-table :data="categoryRecallStats" stripe style="width: 100%">
                <el-table-column prop="category" label="物资分类" width="120">
                  <template #default="{ row }">
                    {{ getCategoryName(row.category) }}
                  </template>
                </el-table-column>
                <el-table-column prop="recallCount" label="召回次数" width="100" />
                <el-table-column prop="totalQuantity" label="召回总数量" width="120" />
                <el-table-column prop="transferredQuantity" label="已调剂数量" width="120" />
                <el-table-column prop="distributedQuantity" label="已发放数量" width="120" />
                <el-table-column label="调剂率" width="120">
                  <template #default="{ row }">
                    <el-progress
                      :percentage="row.totalQuantity > 0 ? Math.round((row.transferredQuantity / row.totalQuantity) * 100) : 0"
                      :status="row.totalQuantity > 0 && row.transferredQuantity / row.totalQuantity > 0.8 ? 'success' : ''"
                    />
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog
      v-model="showCreateDialog"
      title="发起批次召回"
      width="600px"
    >
      <el-form :model="createForm" :rules="createRules" ref="createFormRef" label-width="100px">
        <el-form-item label="批次" prop="batchId">
          <el-select
            v-model="createForm.batchId"
            placeholder="请选择批次"
            style="width: 100%"
            filterable
          >
            <el-option
              v-for="b in availableBatchesForRecall"
              :key="b.id"
              :label="`${b.batchNo} - ${b.materialName} (库存:${b.quantity})`"
              :value="b.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="召回原因" prop="reason">
          <el-select v-model="createForm.reason" placeholder="请选择召回原因" style="width: 100%">
            <el-option label="临期误发" value="expired_misdeliver" />
            <el-option label="规格登记错误" value="spec_error" />
            <el-option label="捐赠方要求定向" value="donor_direction" />
            <el-option label="其他原因" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="原因详情" prop="reasonDetail">
          <el-input
            v-model="createForm.reasonDetail"
            type="textarea"
            :rows="3"
            placeholder="请详细描述召回原因"
          />
        </el-form-item>
        <el-form-item label="操作员" prop="operator">
          <el-input v-model="createForm.operator" placeholder="请输入操作员姓名" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input
            v-model="createForm.remark"
            type="textarea"
            :rows="2"
            placeholder="请输入备注信息（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreateRecall" :loading="creating">确认发起</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showConfirmDialog"
      title="项目负责人确认召回"
      width="600px"
    >
      <div v-if="currentRecall" class="confirm-info">
        <el-alert
          title="请确认已发放数量和未发放数量"
          type="warning"
          :closable="false"
          style="margin-bottom: 20px"
        />
        <p><b>批次号:</b> {{ currentRecall.batchNo }}</p>
        <p><b>物资:</b> {{ currentRecall.materialName }}</p>
        <p><b>召回原因:</b> {{ store.getReasonName(currentRecall.reason) }} - {{ currentRecall.reasonDetail }}</p>
        <p><b>总数量:</b> {{ currentRecall.totalQuantity }}</p>
      </div>
      <el-form :model="confirmForm" :rules="confirmRules" ref="confirmFormRef" label-width="120px" style="margin-top: 20px">
        <el-form-item label="已发放数量" prop="distributedQuantity">
          <el-input-number
            v-model="confirmForm.distributedQuantity"
            :min="0"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="未发放数量" prop="undistributedQuantity">
          <el-input-number
            v-model="confirmForm.undistributedQuantity"
            :min="0"
            style="width: 100%"
          />
          <div class="tip">
            已发放 + 未发放 = <b>{{ confirmForm.distributedQuantity + confirmForm.undistributedQuantity }}</b>
            <span v-if="confirmForm.distributedQuantity + confirmForm.undistributedQuantity !== currentRecall?.totalQuantity" style="color: #f56c6c; margin-left: 10px">
              ⚠ 必须等于总数量({{ currentRecall?.totalQuantity }})
            </span>
          </div>
        </el-form-item>
        <el-form-item label="确认人" prop="confirmer">
          <el-input v-model="confirmForm.confirmer" placeholder="请输入项目负责人姓名" />
        </el-form-item>
        <el-form-item label="确认意见" prop="remark">
          <el-input
            v-model="confirmForm.remark"
            type="textarea"
            :rows="2"
            placeholder="请输入确认意见（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showConfirmDialog = false">取消</el-button>
        <el-button type="primary" @click="handleConfirm" :loading="confirming">确认召回</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showDetailDialog"
      title="召回单详情"
      width="800px"
    >
      <div v-if="currentRecall">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="批次号">{{ currentRecall.batchNo }}</el-descriptions-item>
          <el-descriptions-item label="物资名称">{{ currentRecall.materialName }}</el-descriptions-item>
          <el-descriptions-item label="召回原因">{{ store.getReasonName(currentRecall.reason) }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getRecallStatusTagType(currentRecall.status)" size="small">
              {{ store.getRecallStatusName(currentRecall.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="总数量">{{ currentRecall.totalQuantity }}</el-descriptions-item>
          <el-descriptions-item label="已发放数量">{{ currentRecall.distributedQuantity }}</el-descriptions-item>
          <el-descriptions-item label="未发放数量">{{ currentRecall.undistributedQuantity }}</el-descriptions-item>
          <el-descriptions-item label="发起人">{{ currentRecall.operator }}</el-descriptions-item>
          <el-descriptions-item label="发起日期">{{ currentRecall.createDate }}</el-descriptions-item>
          <el-descriptions-item label="确认人">{{ currentRecall.confirmer || '-' }}</el-descriptions-item>
          <el-descriptions-item label="确认日期">{{ currentRecall.confirmDate || '-' }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ currentRecall.remark || '-' }}</el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">分配情况</el-divider>
        <el-table :data="store.getBatchAllocations(currentRecall.batchId)" stripe style="width: 100%">
          <el-table-column prop="projectName" label="项目" width="150" />
          <el-table-column prop="quantity" label="分配数量" width="100" />
          <el-table-column prop="distributedQuantity" label="已发放" width="100" />
          <el-table-column prop="availableQuantity" label="可调剂" width="100" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 'cancelled' ? 'danger' : 'warning'" size="small">
                {{ row.status === 'cancelled' ? '已取消' : row.status === 'completed' ? '已完成' : '进行中' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>

        <el-divider content-position="left">调剂记录</el-divider>
        <el-table :data="store.getRecallTransfers(currentRecall.id)" stripe style="width: 100%">
          <el-table-column prop="sourceProjectName" label="源项目" width="150" />
          <el-table-column prop="targetProjectName" label="目标项目" width="150" />
          <el-table-column prop="quantity" label="调剂数量" width="100" />
          <el-table-column prop="operator" label="操作员" width="100" />
          <el-table-column prop="createDate" label="日期" width="120" />
          <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
        </el-table>
        <el-empty v-if="store.getRecallTransfers(currentRecall.id).length === 0" description="暂无调剂记录" />

        <el-divider content-position="left">操作追踪</el-divider>
        <el-table :data="store.getRecallTraces(currentRecall.id)" stripe style="width: 100%">
          <el-table-column label="类型" width="110">
            <template #default="{ row }">
              <el-tag :type="getTraceTagType(row.traceType)" size="small">
                {{ store.getTraceTypeName(row.traceType) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="projectName" label="项目" width="120" />
          <el-table-column prop="description" label="操作说明" min-width="200" show-overflow-tooltip />
          <el-table-column prop="operator" label="操作员" width="100" />
          <el-table-column prop="createDate" label="时间" width="160" />
        </el-table>
      </div>
      <template #footer>
        <el-button @click="showDetailDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showTrackDialog"
      title="登记已发放物资追踪"
      width="500px"
    >
      <el-alert
        title="已发放物资不可撤回，只能登记追踪说明"
        type="warning"
        :closable="false"
        style="margin-bottom: 20px"
      />
      <el-form :model="trackForm" :rules="trackRules" ref="trackFormRef" label-width="100px">
        <el-form-item label="发放记录" prop="distributionId">
          <el-select
            v-model="trackForm.distributionId"
            placeholder="请选择发放记录"
            style="width: 100%"
          >
            <el-option
              v-for="d in batchDistributions"
              :key="d.id"
              :label="`${d.projectName} - ${d.receiver} - ${d.quantity}`"
              :value="d.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="项目" prop="projectId">
          <el-select v-model="trackForm.projectId" placeholder="请选择项目" style="width: 100%">
            <el-option
              v-for="p in store.projects"
              :key="p.id"
              :label="p.name"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="追踪说明" prop="description">
          <el-input
            v-model="trackForm.description"
            type="textarea"
            :rows="3"
            placeholder="请详细描述追踪情况"
          />
        </el-form-item>
        <el-form-item label="操作员" prop="operator">
          <el-input v-model="trackForm.operator" placeholder="请输入操作员姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showTrackDialog = false">取消</el-button>
        <el-button type="primary" @click="handleAddTrack" :loading="tracking">确认登记</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showCorrectionDialog"
      title="登记冲正记录"
      width="500px"
    >
      <el-alert
        title="冲正记录用于修正已发放物资的数量误差"
        type="info"
        :closable="false"
        style="margin-bottom: 20px"
      />
      <el-form :model="correctionForm" :rules="correctionRules" ref="correctionFormRef" label-width="100px">
        <el-form-item label="发放记录" prop="distributionId">
          <el-select
            v-model="correctionForm.distributionId"
            placeholder="请选择发放记录"
            style="width: 100%"
            @change="handleDistributionChange"
          >
            <el-option
              v-for="d in availableDistributionsForCorrection"
              :key="d.id"
              :label="`${d.projectName} - ${d.receiver} - ${d.quantity}`"
              :value="d.id"
            />
          </el-select>
        </el-form-item>
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
        <el-button @click="showCorrectionDialog = false">取消</el-button>
        <el-button type="primary" @click="handleAddCorrection" :loading="correcting">确认登记</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { useMaterialStore } from '@/stores/material'
import type {
  MaterialCategory,
  RecallOrder,
  DistributionRecord,
  AllocationRecord
} from '@/types'

const store = useMaterialStore()
const activeTab = ref('recall')

const showCreateDialog = ref(false)
const showConfirmDialog = ref(false)
const showDetailDialog = ref(false)
const showTrackDialog = ref(false)
const showCorrectionDialog = ref(false)

const creating = ref(false)
const confirming = ref(false)
const transferring = ref(false)
const tracking = ref(false)
const correcting = ref(false)

const currentRecall = ref<RecallOrder | null>(null)
const currentDistribution = ref<DistributionRecord | null>(null)
const selectedBatchId = ref('')

const createFormRef = ref<FormInstance>()
const confirmFormRef = ref<FormInstance>()
const transferFormRef = ref<FormInstance>()
const trackFormRef = ref<FormInstance>()
const correctionFormRef = ref<FormInstance>()

const createForm = ref({
  batchId: '',
  reason: '' as any,
  reasonDetail: '',
  operator: '',
  remark: ''
})

const confirmForm = ref({
  distributedQuantity: 0,
  undistributedQuantity: 0,
  confirmer: '',
  remark: ''
})

const transferForm = ref({
  recallId: '',
  sourceProjectId: '',
  targetProjectId: '',
  quantity: 1,
  operator: '',
  remark: '',
  allowOverTransfer: false,
  overTransferConfirmer: ''
})

const trackForm = ref({
  distributionId: '',
  projectId: '',
  description: '',
  operator: ''
})

const correctionForm = ref({
  distributionId: '',
  correctedQuantity: 0,
  reason: '',
  operator: ''
})

const createRules: FormRules = {
  batchId: [{ required: true, message: '请选择批次', trigger: 'change' }],
  reason: [{ required: true, message: '请选择召回原因', trigger: 'change' }],
  reasonDetail: [{ required: true, message: '请输入原因详情', trigger: 'blur' }],
  operator: [{ required: true, message: '请输入操作员', trigger: 'blur' }]
}

const confirmRules: FormRules = {
  distributedQuantity: [{ required: true, message: '请输入已发放数量', trigger: 'blur' }],
  undistributedQuantity: [{ required: true, message: '请输入未发放数量', trigger: 'blur' }],
  confirmer: [{ required: true, message: '请输入确认人', trigger: 'blur' }]
}

const transferRules: FormRules = {
  recallId: [{ required: true, message: '请选择召回单', trigger: 'change' }],
  sourceProjectId: [{ required: true, message: '请选择源项目', trigger: 'change' }],
  targetProjectId: [{ required: true, message: '请选择目标项目', trigger: 'change' }],
  quantity: [{ required: true, message: '请输入调剂数量', trigger: 'blur' }],
  operator: [{ required: true, message: '请输入操作员', trigger: 'blur' }],
  overTransferConfirmer: [
    {
      validator: (_rule, value, callback) => {
        if (isOverTransfer.value && transferForm.value.allowOverTransfer && !value) {
          callback(new Error('超量调剂需要项目负责人确认'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

const trackRules: FormRules = {
  distributionId: [{ required: true, message: '请选择发放记录', trigger: 'change' }],
  projectId: [{ required: true, message: '请选择项目', trigger: 'change' }],
  description: [{ required: true, message: '请输入追踪说明', trigger: 'blur' }],
  operator: [{ required: true, message: '请输入操作员', trigger: 'blur' }]
}

const correctionRules: FormRules = {
  distributionId: [{ required: true, message: '请选择发放记录', trigger: 'change' }],
  correctedQuantity: [{ required: true, message: '请输入冲正数量', trigger: 'blur' }],
  reason: [{ required: true, message: '请输入冲正原因', trigger: 'blur' }],
  operator: [{ required: true, message: '请输入操作员', trigger: 'blur' }]
}

const searchKeyword = ref('')
const filterStatus = ref('')

const availableBatchesForRecall = computed(() => {
  return store.batches.filter(b => !b.isExpired && !b.isRecalled)
})

const filteredRecalls = computed(() => {
  return store.recalls
    .filter(r => {
      if (searchKeyword.value && !r.batchNo.includes(searchKeyword.value) && !r.materialName.includes(searchKeyword.value)) {
        return false
      }
      if (filterStatus.value && r.status !== filterStatus.value) {
        return false
      }
      return true
    })
    .sort((a, b) => b.createDate.localeCompare(a.createDate))
})

const transferableRecalls = computed(() => {
  return store.recalls.filter(r => r.status === 'confirmed' || r.status === 'processing')
})

const sourceAllocations = computed(() => {
  if (!transferForm.value.recallId) return []
  const recall = store.recalls.find(r => r.id === transferForm.value.recallId)
  if (!recall) return []
  return store.getBatchAllocations(recall.batchId).filter(a => a.availableQuantity > 0)
})

const currentSourceAllocation = computed(() => {
  if (!transferForm.value.recallId || !transferForm.value.sourceProjectId) return null
  const recall = store.recalls.find(r => r.id === transferForm.value.recallId)
  if (!recall) return null
  return store.getBatchAllocations(recall.batchId).find(a => a.projectId === transferForm.value.sourceProjectId)
})

const availableTargetProjects = computed(() => {
  if (!transferForm.value.recallId) return []
  const recall = store.recalls.find(r => r.id === transferForm.value.recallId)
  if (!recall) return []
  return store.activeProjects.filter(p => p.id !== transferForm.value.sourceProjectId)
})

const isOverTransfer = computed(() => {
  if (!currentSourceAllocation.value) return false
  return transferForm.value.quantity > currentSourceAllocation.value.availableQuantity
})

const allowOverTransfer = computed(() => transferForm.value.allowOverTransfer)

const selectedBatch = computed(() => {
  if (!selectedBatchId.value) return null
  return store.batches.find(b => b.id === selectedBatchId.value)
})

const batchDistributions = computed(() => {
  if (!selectedBatchId.value) return []
  return store.getBatchDistributions(selectedBatchId.value)
})

const availableDistributionsForCorrection = computed(() => {
  if (!selectedBatchId.value) return []
  const distributions = store.getBatchDistributions(selectedBatchId.value)
  return distributions.filter(d => {
    return !store.corrections.some(c => c.distributionId === d.id)
  })
})

const recallImpactList = computed(() => {
  return store.recalls.map(recall => {
    const transfers = store.getRecallTransfers(recall.id)
    const allocations = store.getBatchAllocations(recall.batchId)
    return {
      ...recall,
      transferredQuantity: transfers.reduce((sum, t) => sum + t.quantity, 0),
      affectedProjects: new Set(allocations.map(a => a.projectId)).size
    }
  }).sort((a, b) => b.createDate.localeCompare(a.createDate))
})

const projectImpactList = computed(() => {
  const projectMap = new Map<string, {
    projectName: string
    affectedBatches: number
    totalQuantity: number
    receivedQuantity: number
    sentQuantity: number
  }>()

  store.transfers.forEach(transfer => {
    if (!projectMap.has(transfer.sourceProjectId)) {
      projectMap.set(transfer.sourceProjectId, {
        projectName: transfer.sourceProjectName,
        affectedBatches: 0,
        totalQuantity: 0,
        receivedQuantity: 0,
        sentQuantity: 0
      })
    }
    const source = projectMap.get(transfer.sourceProjectId)!
    source.affectedBatches++
    source.totalQuantity += transfer.quantity
    source.sentQuantity += transfer.quantity

    if (!projectMap.has(transfer.targetProjectId)) {
      projectMap.set(transfer.targetProjectId, {
        projectName: transfer.targetProjectName,
        affectedBatches: 0,
        totalQuantity: 0,
        receivedQuantity: 0,
        sentQuantity: 0
      })
    }
    const target = projectMap.get(transfer.targetProjectId)!
    target.affectedBatches++
    target.totalQuantity += transfer.quantity
    target.receivedQuantity += transfer.quantity
  })

  return Array.from(projectMap.values())
})

const categoryRecallStats = computed(() => {
  const categories: MaterialCategory[] = ['food', 'clothing', 'daily']
  return categories.map(category => {
    const categoryRecalls = store.recalls.filter(r => r.category === category)
    const transferredQuantity = store.transfers
      .filter(t => t.category === category)
      .reduce((sum, t) => sum + t.quantity, 0)
    const distributedQuantity = categoryRecalls.reduce((sum, r) => sum + r.distributedQuantity, 0)

    return {
      category,
      recallCount: categoryRecalls.length,
      totalQuantity: categoryRecalls.reduce((sum, r) => sum + r.totalQuantity, 0),
      transferredQuantity,
      distributedQuantity
    }
  })
})

function getCategoryName(category: MaterialCategory): string {
  const map: Record<MaterialCategory, string> = {
    food: '食品',
    clothing: '衣物',
    daily: '日用品'
  }
  return map[category]
}

function getRecallStatusTagType(status: string): 'success' | 'warning' | 'info' | 'danger' {
  const map: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
    pending: 'warning',
    confirmed: 'info',
    processing: 'warning',
    completed: 'success',
    cancelled: 'danger'
  }
  return map[status] || 'info'
}

function getTraceTagType(type: string): 'success' | 'warning' | 'info' | 'danger' {
  const map: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
    recall: 'warning',
    distributed_track: 'info',
    correction: 'danger',
    transfer: 'success'
  }
  return map[type] || 'info'
}

async function handleCreateRecall() {
  if (!createFormRef.value) return
  await createFormRef.value.validate(async (valid) => {
    if (!valid) return

    creating.value = true
    const result = store.createRecall({
      batchId: createForm.value.batchId,
      reason: createForm.value.reason,
      reasonDetail: createForm.value.reasonDetail,
      operator: createForm.value.operator,
      remark: createForm.value.remark
    })
    creating.value = false

    if (result.success) {
      ElMessage.success(result.message)
      showCreateDialog.value = false
      resetCreateForm()
    } else {
      ElMessage.error(result.message)
    }
  })
}

function resetCreateForm() {
  createForm.value = {
    batchId: '',
    reason: '' as any,
    reasonDetail: '',
    operator: '',
    remark: ''
  }
  createFormRef.value?.resetFields()
}

function openConfirmDialog(recall: RecallOrder) {
  currentRecall.value = recall
  confirmForm.value = {
    distributedQuantity: recall.distributedQuantity,
    undistributedQuantity: recall.undistributedQuantity,
    confirmer: '',
    remark: ''
  }
  showConfirmDialog.value = true
}

async function handleConfirm() {
  if (!confirmFormRef.value || !currentRecall.value) return
  const recall = currentRecall.value
  await confirmFormRef.value.validate(async (valid) => {
    if (!valid) return

    if (confirmForm.value.distributedQuantity + confirmForm.value.undistributedQuantity !== recall.totalQuantity) {
      ElMessage.error('已发放数量 + 未发放数量必须等于总数量')
      return
    }

    confirming.value = true
    const result = store.confirmRecall({
      recallId: recall.id,
      confirmer: confirmForm.value.confirmer,
      distributedQuantity: confirmForm.value.distributedQuantity,
      undistributedQuantity: confirmForm.value.undistributedQuantity,
      remark: confirmForm.value.remark
    })
    confirming.value = false

    if (result.success) {
      ElMessage.success(result.message)
      showConfirmDialog.value = false
    } else {
      ElMessage.error(result.message)
    }
  })
}

function openDetailDialog(recall: RecallOrder) {
  currentRecall.value = recall
  showDetailDialog.value = true
}

async function handleStartProcessing(recall: RecallOrder) {
  try {
    await ElMessageBox.confirm(
      '确定要开始处理该召回单吗？',
      '开始处理确认',
      { type: 'warning', confirmButtonText: '确认开始', cancelButtonText: '取消' }
    )
    const result = store.startProcessingRecall(recall.id, recall.operator)
    if (result.success) {
      ElMessage.success(result.message)
    } else {
      ElMessage.error(result.message)
    }
  } catch {
  }
}

async function handleComplete(recall: RecallOrder) {
  try {
    await ElMessageBox.confirm(
      '确定要完成该召回单吗？完成后将无法再进行调剂操作。',
      '完成确认',
      { type: 'warning', confirmButtonText: '确认完成', cancelButtonText: '取消' }
    )
    const result = store.completeRecall(recall.id, recall.operator)
    if (result.success) {
      ElMessage.success(result.message)
    } else {
      ElMessage.error(result.message)
    }
  } catch {
  }
}

async function handleCancel(recall: RecallOrder) {
  try {
    await ElMessageBox.confirm(
      '确定要取消该召回单吗？',
      '取消确认',
      { type: 'warning', confirmButtonText: '确认取消', cancelButtonText: '继续处理' }
    )
    const result = store.cancelRecall(recall.id, recall.operator)
    if (result.success) {
      ElMessage.success(result.message)
    } else {
      ElMessage.error(result.message)
    }
  } catch {
  }
}

function handleRecallChange() {
  transferForm.value.sourceProjectId = ''
  transferForm.value.targetProjectId = ''
  transferForm.value.quantity = 1
}

async function handleTransfer() {
  if (!transferFormRef.value) return
  await transferFormRef.value.validate(async (valid) => {
    if (!valid) return

    if (!currentSourceAllocation.value) {
      ElMessage.error('源项目没有该批次的分配记录')
      return
    }

    if (isOverTransfer.value && !transferForm.value.allowOverTransfer) {
      ElMessage.error(`调剂数量(${transferForm.value.quantity})超过可调剂数量(${currentSourceAllocation.value.availableQuantity})，请勾选本地验收超量调剂并确认`)
      return
    }

    if (isOverTransfer.value && transferForm.value.allowOverTransfer && !transferForm.value.overTransferConfirmer) {
      ElMessage.error('超量调剂需要项目负责人确认签字')
      return
    }

    transferring.value = true
    const result = store.transferMaterial({
      recallId: transferForm.value.recallId,
      sourceProjectId: transferForm.value.sourceProjectId,
      targetProjectId: transferForm.value.targetProjectId,
      quantity: transferForm.value.quantity,
      operator: transferForm.value.operator,
      remark: isOverTransfer.value
        ? `【超量调剂，负责人确认：${transferForm.value.overTransferConfirmer}】${transferForm.value.remark || ''}`
        : transferForm.value.remark,
      allowOverTransfer: transferForm.value.allowOverTransfer,
      overTransferConfirmer: transferForm.value.overTransferConfirmer
    })
    transferring.value = false

    if (result.success) {
      ElMessage.success(result.message)
      resetTransferForm()
    } else {
      ElMessage.error(result.message)
    }
  })
}

function resetTransferForm() {
  transferForm.value = {
    recallId: '',
    sourceProjectId: '',
    targetProjectId: '',
    quantity: 1,
    operator: '',
    remark: '',
    allowOverTransfer: false,
    overTransferConfirmer: ''
  }
  transferFormRef.value?.resetFields()
}

async function handleAddTrack() {
  if (!trackFormRef.value) return
  await trackFormRef.value.validate(async (valid) => {
    if (!valid) return

    const activeRecall = store.recalls.find(
      r => r.batchId === selectedBatchId.value &&
           (r.status === 'confirmed' || r.status === 'processing')
    )
    if (!activeRecall) {
      ElMessage.error('该批次没有正在处理的召回单，无法登记追踪')
      return
    }

    tracking.value = true
    const result = store.addDistributedTrack({
      recallId: activeRecall.id,
      distributionId: trackForm.value.distributionId,
      projectId: trackForm.value.projectId,
      description: trackForm.value.description,
      operator: trackForm.value.operator
    })
    tracking.value = false

    if (result.success) {
      ElMessage.success(result.message)
      showTrackDialog.value = false
      resetTrackForm()
    } else {
      ElMessage.error(result.message)
    }
  })
}

function resetTrackForm() {
  trackForm.value = {
    distributionId: '',
    projectId: '',
    description: '',
    operator: ''
  }
  trackFormRef.value?.resetFields()
}

function handleDistributionChange() {
  const distribution = store.distributions.find(d => d.id === correctionForm.value.distributionId)
  currentDistribution.value = distribution || null
  correctionForm.value.correctedQuantity = distribution?.quantity || 0
}

async function handleAddCorrection() {
  if (!correctionFormRef.value) return
  await correctionFormRef.value.validate(async (valid) => {
    if (!valid) return

    correcting.value = true
    const result = store.createCorrection({
      distributionId: correctionForm.value.distributionId,
      correctedQuantity: correctionForm.value.correctedQuantity,
      reason: correctionForm.value.reason,
      operator: correctionForm.value.operator
    })
    correcting.value = false

    if (result.success) {
      if (selectedBatchId.value) {
        const distribution = store.distributions.find(d => d.id === correctionForm.value.distributionId)
        if (distribution) {
          store.addTrace({
            recallId: null,
            batchId: selectedBatchId.value,
            traceType: 'correction',
            projectId: distribution.projectId,
            projectName: distribution.projectName,
            quantity: correctionForm.value.correctedQuantity,
            description: `冲正记录：${correctionForm.value.reason}，冲正数量：${correctionForm.value.correctedQuantity}`,
            operator: correctionForm.value.operator
          })
          store.persistAll()
        }
      }
      ElMessage.success(result.message)
      showCorrectionDialog.value = false
      resetCorrectionForm()
    } else {
      ElMessage.error(result.message)
    }
  })
}

function resetCorrectionForm() {
  correctionForm.value = {
    distributionId: '',
    correctedQuantity: 0,
    reason: '',
    operator: ''
  }
  currentDistribution.value = null
  correctionFormRef.value?.resetFields()
}
</script>

<style scoped>
.recall-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stats-card {
  margin-bottom: 0;
}

.stat-item {
  text-align: center;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}

.stat-value.warning {
  color: #e6a23c;
}

.stat-value.success {
  color: #67c23a;
}

.stat-value.info {
  color: #409eff;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 5px;
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

.batch-info {
  margin-top: 20px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 8px;
}

.batch-info h4 {
  margin: 0 0 10px 0;
  color: #303133;
}

.batch-info p {
  margin: 5px 0;
  font-size: 14px;
}

.batch-actions {
  margin-top: 15px;
  display: flex;
  gap: 10px;
}

.confirm-info p {
  margin: 8px 0;
  font-size: 14px;
}

.tab-content {
  padding-top: 10px;
}

.main-card :deep(.el-tabs__header) {
  margin-bottom: 20px;
}
</style>
