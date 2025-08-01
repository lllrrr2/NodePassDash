"use client";

import {
  Button,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Pagination,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  useDisclosure,
  Input,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  ButtonGroup,
  Select,
  SelectItem,
  Code,
  Tooltip,
  SortDescriptor
} from "@heroui/react";
import { Selection } from "@react-types/shared";
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faEye, 
  faEyeSlash,
  faPause, 
  faPlay, 
  faStop,
  faTrash,
  faRotateRight,
  faPen,
  faPlus,
  faRocket,
  faLayerGroup,
  faCopy,
  faHammer,
  faSearch,
  faChevronDown,
  faBolt,
  faDownload,
  faQuestionCircle,
  faTag,
  faRecycle
} from "@fortawesome/free-solid-svg-icons";
import { useRouter } from "next/navigation";
import { Box, Flex } from "@/components";
import { TunnelToolBox } from "./components/toolbox";
import { useTunnelActions } from "@/lib/hooks/use-tunnel-actions";
import { addToast } from "@heroui/toast";
import { buildApiUrl } from '@/lib/utils';
import { copyToClipboard } from '@/lib/utils/clipboard';
import ManualCopyModal from '@/components/ui/manual-copy-modal';
import QuickCreateTunnelModal from "./components/quick-create-tunnel-modal";
import BatchCreateModal from "./components/batch-create-modal";
import ManualCreateTunnelModal from "./components/manual-create-tunnel-modal";
import TagManagementModal from "./components/tag-management-modal";
import SimpleTagModal from "./components/simple-tag-modal";
import { useGlobalVisibility } from '@/lib/hooks/use-global-visibility';

// 定义标签类型
interface Tag {
  id: number;
  name: string;
}

// 定义实例类型
interface Tunnel {
  id: string;
  instanceId?: string;
  type: string;
  name: string;
  endpoint: string;
  endpointId: string;
  tunnelAddress: string;
  tunnelPort: string;
  targetAddress: string;
  targetPort: string;
  status: {
    type: "success" | "danger" | "warning";
    text: string;
  };
  avatar: string;
  // 客户端模式的连接池配置
  min?: number;
  max?: number;
  // 流量统计信息
  traffic?: {
    tcpRx: number;
    tcpTx: number;
    udpRx: number;
    udpTx: number;
  };
  // 标签信息
  tag?: Tag;
}

interface Endpoint {
  id: string;
  name: string;
}

export default function TunnelsPage() {
  const router = useRouter();
  const [filterValue, setFilterValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [endpointFilter, setEndpointFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(() => {
    // 从 localStorage 读取保存的每页显示数量，默认为 10
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tunnels-rows-per-page');
      return saved ? parseInt(saved, 10) : 10;
    }
    return 10;
  });
  const [page, setPage] = useState(1);
  const [deleteModalTunnel, setDeleteModalTunnel] = useState<Tunnel | null>(null);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  
  // 添加编辑名称相关的状态
  const [editModalTunnel, setEditModalTunnel] = useState<Tunnel | null>(null);
  const [newTunnelName, setNewTunnelName] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditLoading, setIsEditLoading] = useState(false);

  // 导出配置模态框状态
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportConfig, setExportConfig] = useState("");

  // 使用全局可见性Hook
  const globalVisibility = useGlobalVisibility();

  // 使用共用的实例操作 hook
  const { toggleStatus, restart, deleteTunnel } = useTunnelActions();

  // 实例数据状态，支持动态更新
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [endpointsLoading, setEndpointsLoading] = useState(true);

  // 是否移入回收站
  const [moveToRecycle, setMoveToRecycle] = useState(false);

  // 编辑模态控制
  const [editModalOpen,setEditModalOpen]=useState(false);
  const [editTunnel,setEditTunnel]=useState<Tunnel|null>(null);

  // 批量创建模态控制
  const [batchCreateOpen, setBatchCreateOpen] = useState(false);

  // 快建实例模态控制
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  // 手搓创建模态控制
  const [manualCreateOpen, setManualCreateOpen] = useState(false);

  // 批量删除确认模态控制
  const [batchDeleteModalOpen, setBatchDeleteModalOpen] = useState(false);
  const [batchMoveToRecycle, setBatchMoveToRecycle] = useState(false);

  // 表格多选
  const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set<string>());

  // 排序状态
  const [sortDescriptor, setSortDescriptor] = useState<{
    column: string | null;
    direction: "ascending" | "descending";
  }>({
    column: null,
    direction: "ascending",
  });

  // 排序处理函数
  const handleSortChange = (descriptor: any) => {
    setSortDescriptor({
      column: descriptor.column ? String(descriptor.column) : null,
      direction: descriptor.direction,
    });
  };

  // 获取实例列表
  const fetchTunnels = async () => {
    try {
      setLoading(true);
      const response = await fetch(buildApiUrl('/api/tunnels'));
      if (!response.ok) throw new Error('获取实例列表失败');
      const data = await response.json();
      setTunnels(data);
    } catch (error) {
      console.error('获取实例列表失败:', error);
      addToast({
        title: '错误',
        description: '获取实例列表失败',
        color: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  // 获取主控列表
  const fetchEndpoints = async () => {
    try {
      setEndpointsLoading(true);
      const response = await fetch(buildApiUrl('/api/endpoints/simple'));
      if (!response.ok) throw new Error('获取主控列表失败');
      const data = await response.json();
      setEndpoints(data);
    } catch (error) {
      console.error('获取主控列表失败:', error);
      addToast({
        title: '错误',
        description: '获取主控列表失败',
        color: 'danger'
      });
    } finally {
      setEndpointsLoading(false);
    }
  };

  // 获取标签列表
  const fetchTags = async () => {
    try {
      setTagsLoading(true);
      const response = await fetch(buildApiUrl('/api/tags'));
      if (!response.ok) throw new Error('获取标签列表失败');
      const data = await response.json();
      setTags(data.tags || []);
    } catch (error) {
      console.error('获取标签列表失败:', error);
      addToast({
        title: '错误',
        description: '获取标签列表失败',
        color: 'danger'
      });
    } finally {
      setTagsLoading(false);
    }
  };

  // 状态选项
  const statusOptions = [
    { label: "所有状态", value: "all" },
    { label: "运行中", value: "running" },
    { label: "已停止", value: "stopped" },
    { label: "有错误", value: "error" },
    { label: "已离线", value: "offline" },
  ];

  // 获取选中主控名称
  const getSelectedEndpointName = () => {
    if (endpointFilter === "all") return "所有主控";
    const endpoint = endpoints.find(ep => String(ep.id) === String(endpointFilter));
    return endpoint ? endpoint.name : "所有主控";
  };

  // 处理实例操作
  const handleTunnelAction = async (tunnelId: string, action: string) => {
    try {
      const response = await fetch(buildApiUrl(`/api/tunnels/${tunnelId}/action`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '操作失败');
      }

      // 刷新实例列表
      await fetchTunnels();

      addToast({
        title: '成功',
        description: '操作成功',
        color: 'success'
      });
    } catch (error) {
      console.error('实例操作失败:', error);
      addToast({
        title: '错误',
        description: error instanceof Error ? error.message : '操作失败',
        color: 'danger'
      });
    }
  };

  // 处理删除实例
  const handleDelete = async (tunnelId: string) => {
    try {
      const response = await fetch(buildApiUrl(`/api/tunnels/${tunnelId}`), {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '删除失败');
      }

      // 刷新实例列表
      await fetchTunnels();

      addToast({
        title: '成功',
        description: '删除成功',
        color: 'success'
      });
    } catch (error) {
      console.error('删除实例失败:', error);
      addToast({
        title: '错误',
        description: error instanceof Error ? error.message : '删除失败',
        color: 'danger'
      });
    }
  };

  // 计算已选中数量（支持全选）
  const getSelectedCount = () => {
    if (selectedKeys === "all") return filteredItems.length;
    if (selectedKeys instanceof Set) return selectedKeys.size;
    return 0;
  };

  // 显示批量删除确认弹窗
  const showBatchDeleteModal = () => {
    setBatchDeleteModalOpen(true);
  };

  // 执行批量删除
  const executeBatchDelete = async () => {
    if (!selectedKeys || (selectedKeys instanceof Set && selectedKeys.size === 0)) return;

    // 计算待删除的 ID 列表
    let ids: number[] = [];
    if (selectedKeys === "all") {
      ids = filteredItems.map((t) => Number(t.id));
    } else {
      ids = Array.from(selectedKeys as Set<string>).map((id) => Number(id));
    }

    setBatchDeleteModalOpen(false);

    // 使用 promise 形式的 Toast
    addToast({
      timeout: 1,
      title: "批量删除中...",
      description: "正在删除所选实例，请稍候",
      color: "primary",
      promise: fetch(buildApiUrl('/api/tunnels/batch'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          ids,
          recycle: batchMoveToRecycle
        }),
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data?.error || '批量删除失败');
          }

          // 成功提示
          addToast({
            title: '批量删除成功',
            description: `已删除 ${data.deleted || ids.length} 个实例`,
            color: 'success',
          });

          // 清空选择并刷新
          setSelectedKeys(new Set<string>());
          setBatchMoveToRecycle(false);
          fetchTunnels();

          return data;
        })
        .catch((error) => {
          // 失败提示
          addToast({
            title: '批量删除失败',
            description: error instanceof Error ? error.message : '未知错误',
            color: 'danger',
          });
          throw error;
        }),
    });
  };

  // 执行批量启动
  const executeBatchStart = async () => {
    if (!selectedKeys || (selectedKeys instanceof Set && selectedKeys.size === 0)) {
      addToast({
        title: '批量启动失败',
        description: '请先选择需要启动的实例',
        color: 'warning'
      });
      return;
    }

    // 计算待启动的实例列表
    let selectedTunnels: Tunnel[] = [];
    if (selectedKeys === "all") {
      selectedTunnels = filteredItems;
    } else {
      selectedTunnels = filteredItems.filter(tunnel => 
        (selectedKeys as Set<string>).has(String(tunnel.id))
      );
    }

    // 过滤出已停止的实例
    const stoppedTunnels = selectedTunnels.filter(tunnel => tunnel.status.type !== "success");
    
    if (stoppedTunnels.length === 0) {
      addToast({
        title: '批量启动失败',
        description: '所选实例中没有可启动的实例（已停止状态）',
        color: 'warning'
      });
      return;
    }

    // 执行批量启动
    addToast({
      timeout: 1,
      title: "批量启动中...",
      description: `正在启动 ${stoppedTunnels.length} 个实例，请稍候`,
      color: "primary",
      promise: fetch(buildApiUrl('/api/tunnels/batch/action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ids: stoppedTunnels.map(t => Number(t.id)),
          action: 'start'
        })
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || '批量启动失败');
          }

          const succeeded = data.operated || 0;
          const failed = data.failCount || 0;

          if (succeeded > 0) {
            addToast({
              title: '批量启动完成',
              description: `成功启动 ${succeeded} 个实例${failed > 0 ? `，${failed} 个失败` : ''}`,
              color: failed === 0 ? 'success' : 'warning',
            });
          }

          if (failed > 0 && data.results) {
            const failedTunnels = data.results.filter((r: any) => !r.success);
            console.error('启动失败的实例:', failedTunnels.map((f: any) => `${f.name}: ${f.error}`));
          }

          // 刷新实例列表
          fetchTunnels();
          return { succeeded, failed };
        })
        .catch((error) => {
          addToast({
            title: '批量启动失败',
            description: error instanceof Error ? error.message : '未知错误',
            color: 'danger',
          });
          throw error;
        }),
    });
  };

  // 执行批量停止
  const executeBatchStop = async () => {
    if (!selectedKeys || (selectedKeys instanceof Set && selectedKeys.size === 0)) {
      addToast({
        title: '批量停止失败',
        description: '请先选择需要停止的实例',
        color: 'warning'
      });
      return;
    }

    // 计算待停止的实例列表
    let selectedTunnels: Tunnel[] = [];
    if (selectedKeys === "all") {
      selectedTunnels = filteredItems;
    } else {
      selectedTunnels = filteredItems.filter(tunnel => 
        (selectedKeys as Set<string>).has(String(tunnel.id))
      );
    }

    // 过滤出运行中的实例
    const runningTunnels = selectedTunnels.filter(tunnel => tunnel.status.type === "success");
    
    if (runningTunnels.length === 0) {
      addToast({
        title: '批量停止失败',
        description: '所选实例中没有可停止的实例（运行中状态）',
        color: 'warning'
      });
      return;
    }

    // 执行批量停止
    addToast({
      timeout: 1,
      title: "批量停止中...",
      description: `正在停止 ${runningTunnels.length} 个实例，请稍候`,
      color: "primary",
      promise: fetch(buildApiUrl('/api/tunnels/batch/action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ids: runningTunnels.map(t => Number(t.id)),
          action: 'stop'
        })
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || '批量停止失败');
          }

          const succeeded = data.operated || 0;
          const failed = data.failCount || 0;

          if (succeeded > 0) {
            addToast({
              title: '批量停止完成',
              description: `成功停止 ${succeeded} 个实例${failed > 0 ? `，${failed} 个失败` : ''}`,
              color: failed === 0 ? 'success' : 'warning',
            });
          }

          if (failed > 0 && data.results) {
            const failedTunnels = data.results.filter((r: any) => !r.success);
            console.error('停止失败的实例:', failedTunnels.map((f: any) => `${f.name}: ${f.error}`));
          }

          // 刷新实例列表
          fetchTunnels();
          return { succeeded, failed };
        })
        .catch((error) => {
          addToast({
            title: '批量停止失败',
            description: error instanceof Error ? error.message : '未知错误',
            color: 'danger',
          });
          throw error;
        }),
    });
  };

  // 执行批量重启
  const executeBatchRestart = async () => {
    if (!selectedKeys || (selectedKeys instanceof Set && selectedKeys.size === 0)) {
      addToast({
        title: '批量重启失败',
        description: '请先选择需要重启的实例',
        color: 'warning'
      });
      return;
    }

    // 计算待重启的实例列表
    let selectedTunnels: Tunnel[] = [];
    if (selectedKeys === "all") {
      selectedTunnels = filteredItems;
    } else {
      selectedTunnels = filteredItems.filter(tunnel => 
        (selectedKeys as Set<string>).has(String(tunnel.id))
      );
    }

    // 过滤出运行中的实例（只有运行中的实例才能重启）
    const runningTunnels = selectedTunnels.filter(tunnel => tunnel.status.type === "success");
    
    if (runningTunnels.length === 0) {
      addToast({
        title: '批量重启失败',
        description: '所选实例中没有可重启的实例（运行中状态）',
        color: 'warning'
      });
      return;
    }

    // 执行批量重启
    addToast({
      timeout: 1,
      title: "批量重启中...",
      description: `正在重启 ${runningTunnels.length} 个实例，请稍候`,
      color: "primary",
      promise: fetch(buildApiUrl('/api/tunnels/batch/action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ids: runningTunnels.map(t => Number(t.id)),
          action: 'restart'
        })
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || '批量重启失败');
          }

          const succeeded = data.operated || 0;
          const failed = data.failCount || 0;

          if (succeeded > 0) {
            addToast({
              title: '批量重启完成',
              description: `成功重启 ${succeeded} 个实例${failed > 0 ? `，${failed} 个失败` : ''}`,
              color: failed === 0 ? 'success' : 'warning',
            });
          }

          if (failed > 0 && data.results) {
            const failedTunnels = data.results.filter((r: any) => !r.success);
            console.error('重启失败的实例:', failedTunnels.map((f: any) => `${f.name}: ${f.error}`));
          }

          // 刷新实例列表
          fetchTunnels();
          return { succeeded, failed };
        })
        .catch((error) => {
          addToast({
            title: '批量重启失败',
            description: error instanceof Error ? error.message : '未知错误',
            color: 'danger',
          });
          throw error;
        }),
    });
  };

  // 导出配置功能
  const handleExportConfig = () => {
    if (!selectedKeys || (selectedKeys instanceof Set && selectedKeys.size === 0)) return;

    // 计算要导出的隧道
    let selectedTunnels: Tunnel[] = [];
    if (selectedKeys === "all") {
      selectedTunnels = filteredItems;
    } else {
      // 确保字符串匹配，因为 selectedKeys 是字符串类型
      selectedTunnels = filteredItems.filter(tunnel => 
        (selectedKeys as Set<string>).has(String(tunnel.id))
      );
    }

    // 转换为导出格式
    const exportData = selectedTunnels.map(tunnel => ({
      dest: `${tunnel.targetAddress}:${tunnel.targetPort}`,
      listen_port: parseInt(tunnel.tunnelPort),
      name: tunnel.name
    }));

    // 格式化为您期望的样式，每个对象平铺一行
    const flattenedConfig = "[\n" + exportData.map(item => 
      `  ${JSON.stringify(item)}`
    ).join(",\n") + "\n]";

    setExportConfig(flattenedConfig);
    setExportModalOpen(true);
  };

  // 手动复制模态框状态
  const [manualCopyText, setManualCopyText] = useState<string>('');
  const [isManualCopyOpen, setIsManualCopyOpen] = useState(false);

  // 标签管理模态框状态
  const [tagManagementModalOpen, setTagManagementModalOpen] = useState(false);
  
  // 简化标签设置模态框状态
  const [simpleTagModalOpen, setSimpleTagModalOpen] = useState(false);
  const [currentTunnelForTag, setCurrentTunnelForTag] = useState<Tunnel | null>(null);
  
  const showManualCopyModal = (text: string) => {
    setManualCopyText(text);
    setIsManualCopyOpen(true);
  };

  // 复制配置到剪贴板
  const copyExportConfig = async () => {
    copyToClipboard(exportConfig, '配置已复制到剪贴板', showManualCopyModal);
  };

  // 格式化地址显示（处理脱敏逻辑）
  const formatAddress = (address: string, port: string) => {
    // 如果显示完整地址，直接返回
    if (globalVisibility.tunnels.showFullAddress) {
      return `${address}:${port}`;
    }
    
    // 如果地址是 127.0.0.1 或为空，保持原样显示
    if (address === '127.0.0.1' || address === '' || !address) {
      return `${address}:${port}`;
    }
    
    // 其他情况显示脱敏地址
    return `**.**.**.**:${port}`;
  };

  // 格式化流量显示
  const formatTraffic = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // 格式化流量信息组件
  const TrafficInfo = ({ traffic }: { traffic?: Tunnel['traffic'] }) => {
    if (!traffic) {
      return (
        <div className="text-xs text-default-400">
          <div>TCP: - / -</div>
          <div>UDP: - / -</div>
        </div>
      );
    }

    return (
      <div className="text-xs">
        <div className="text-default-600">
          <span className="text-success-600">↓{formatTraffic(traffic.tcpRx)}</span>
          {" / "}
          <span className="text-warning-600">↑{formatTraffic(traffic.tcpTx)}</span>
        </div>
        <div className="text-default-500">
          <span className="text-success-500">↓{formatTraffic(traffic.udpRx)}</span>
          {" / "}
          <span className="text-warning-500">↑{formatTraffic(traffic.udpTx)}</span>
        </div>
      </div>
    );
  };

  // 初始加载
  React.useEffect(() => {
    fetchTunnels();
    fetchEndpoints();
    fetchTags();
  }, []);



  const columns = [
    { key: "type", label: "类型", sortable: false },
    { key: "name", label: "名称", sortable: true },
    { key: "endpoint", label: "主控", sortable: false },
    { 
      key: "tunnelAddress", 
      label: (
        <div className="flex items-center gap-1">
          <span>隧道地址</span>
          <Tooltip content={globalVisibility.tunnels.showFullAddress ? "点击隐藏IP地址" : "点击显示完整IP地址"} size="sm">
            <FontAwesomeIcon 
              icon={globalVisibility.tunnels.showFullAddress ? faEyeSlash : faEye }
              className="text-xs cursor-pointer hover:text-primary" 
              onClick={globalVisibility.tunnels.toggleShowFullAddress}
            />
          </Tooltip>
        </div>
      ),
      sortable: false
    },
    { 
      key: "targetAddress", 
      label: (
        <div className="flex items-center gap-1">
          <span>目标地址</span>
          <Tooltip content={globalVisibility.tunnels.showFullAddress ? "点击隐藏IP地址" : "点击显示完整IP地址"} size="sm">
            <FontAwesomeIcon 
              icon={globalVisibility.tunnels.showFullAddress ? faEyeSlash : faEye}
              className="text-xs cursor-pointer hover:text-primary" 
              onClick={globalVisibility.tunnels.toggleShowFullAddress}
            />
          </Tooltip>
        </div>
      ),
      sortable: false
    },
    { key: "status", label: "状态", sortable: false  },
    { key: "tag", label: "标签", sortable: false },
    { 
      key: "traffic", 
      label: (
        <div className="flex items-center gap-1">
          <span>流量统计</span>
          <Tooltip 
            content={
              <div className="text-xs">
                <div>第一行：TCP 下载↓ / 上传↑</div>
                <div>第二行：UDP 下载↓ / 上传↑</div>
              </div>
            } 
            size="sm"
          >
            <FontAwesomeIcon 
              icon={faQuestionCircle}
              className="text-xs text-default-400 hover:text-default-600 cursor-help" 
            />
          </Tooltip>
        </div>
      ),
      sortable: false
    },
    { key: "actions", label: "操作", sortable: false },
  ];

  // 更新实例状态的函数
  const handleStatusChange = (tunnelId: string, isRunning: boolean) => {
    setTunnels(prev => prev.map(tunnel => 
      tunnel.id === tunnelId 
        ? {
            ...tunnel,
            status: {
              type: isRunning ? "success" as const : "danger" as const,
              text: isRunning ? "运行中" : "已停止"
            }
          }
        : tunnel
    ));
  };

  // 删除实例的函数
  const handleDeleteTunnel = (tunnelId: string) => {
    setTunnels(prev => prev.filter(tunnel => tunnel.id !== tunnelId));
  };

  // 操作按钮处理函数
  const handleToggleStatus = (tunnel: any) => {
    if (!tunnel.instanceId) {
      alert('此实例缺少NodePass ID，无法执行操作');
      return;
    }
    const isRunning = tunnel.status.type === "success";
    toggleStatus(isRunning, {
      instanceId: tunnel.instanceId,
      tunnelId: tunnel.id,
      tunnelName: tunnel.name,
      onStatusChange: (tunnelId, newStatus) => {
        handleStatusChange(tunnelId, newStatus);
        fetchTunnels();
      },
    });
  };

  const handleRestart = (tunnel: any) => {
    if (!tunnel.instanceId) {
      alert('此实例缺少NodePass ID，无法执行操作');
      return;
    }
    restart({
      instanceId: tunnel.instanceId,
      tunnelId: tunnel.id,
      tunnelName: tunnel.name,
      onStatusChange: (tunnelId, newStatus) => {
        handleStatusChange(tunnelId, newStatus);
        fetchTunnels();
      },
    });
  };

  const handleDeleteClick = (tunnel: any) => {
    setDeleteModalTunnel(tunnel);
    onOpen();
  };

  const confirmDelete = () => {
    if (deleteModalTunnel) {
      deleteTunnel({
        tunnelId: deleteModalTunnel.id,
        instanceId: deleteModalTunnel.instanceId || '',
        tunnelName: deleteModalTunnel.name,
        redirectAfterDelete: false,
        recycle: moveToRecycle,
        onSuccess: () => {
          fetchTunnels();
        }
      });
    }
    onOpenChange();
    setMoveToRecycle(false);
  };

  // 添加修改名称的处理函数
  const handleEditClick = (tunnel: Tunnel) => {
    setEditModalTunnel(tunnel);
    setNewTunnelName(tunnel.name);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editModalTunnel || !newTunnelName.trim()) return;

    try {
      setIsEditLoading(true);
      const response = await fetch(buildApiUrl(`/api/tunnels/${editModalTunnel.id}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'rename',
          name: newTunnelName.trim()
        }),
      });

      if (!response.ok) throw new Error('修改名称失败');

      // 更新本地状态
      setTunnels(prev => prev.map(tunnel => 
        tunnel.id === editModalTunnel.id 
          ? { ...tunnel, name: newTunnelName.trim() }
          : tunnel
      ));

      addToast({
        title: "修改成功",
        description: "实例名称已更新",
        color: "success",
      });

      setIsEditModalOpen(false);
    } catch (error) {
      console.error('修改名称失败:', error);
      addToast({
        title: "修改失败",
        description: error instanceof Error ? error.message : "未知错误",
        color: "danger",
      });
    } finally {
      setIsEditLoading(false);
    }
  };

  // 处理标签管理
  const handleTagManagement = () => {
    setTagManagementModalOpen(true);
  };

  // 处理简化标签设置
  const handleTagClick = (tunnel: Tunnel) => {
    setCurrentTunnelForTag(tunnel);
    setSimpleTagModalOpen(true);
  };

  const handleTagSaved = () => {
    fetchTunnels();
    fetchTags();
  };

  const filteredItems = React.useMemo(() => {
    let filtered = [...tunnels];

    if (filterValue) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(filterValue.toLowerCase()) ||
        item.tunnelAddress.toLowerCase().includes(filterValue.toLowerCase()) ||
        item.targetAddress.toLowerCase().includes(filterValue.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(item => {
        switch (statusFilter) {
          case "running":
            return item.status.type === "success";
          case "stopped":
            return item.status.type === "danger";
          case "error":
            return item.status.type === "warning";
          case "offline":
            return item.status.text === "离线";
          default:
            return true;
        }
      });
    }

    if (endpointFilter !== "all") {
      filtered = filtered.filter(item => {
        return String(item.endpointId) === String(endpointFilter);
      });
    }

    if (tagFilter !== "all") {
      filtered = filtered.filter(item => {
        if (tagFilter === "untagged") {
          return !item.tag;
        }
        return item.tag && String(item.tag.id) === String(tagFilter);
      });
    }

    // 添加排序逻辑
    if (sortDescriptor.column) {
      filtered.sort((a, b) => {
        let first: string | number = "";
        let second: string | number = "";

        // 特殊处理name字段的排序
        if (sortDescriptor.column === "name") {
          first = (a.name || "").toLowerCase();
          second = (b.name || "").toLowerCase();
        } else {
          // 其他字段可以在这里扩展
          const aVal = a[sortDescriptor.column as keyof Tunnel];
          const bVal = b[sortDescriptor.column as keyof Tunnel];
          first = String(aVal || "").toLowerCase();
          second = String(bVal || "").toLowerCase();
        }

        const cmp = first < second ? -1 : first > second ? 1 : 0;

        return sortDescriptor.direction === "descending" ? -cmp : cmp;
      });
    }

    return filtered;
  }, [tunnels, filterValue, statusFilter, endpointFilter, tagFilter, sortDescriptor]);

  const pages = Math.ceil(filteredItems.length / rowsPerPage);
  const items = React.useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;

    return filteredItems.slice(start, end);
  }, [page, filteredItems, rowsPerPage]);



  const onSearchChange = React.useCallback((value?: string) => {
    if (value) {
      setFilterValue(value);
      setPage(1);
    } else {
      setFilterValue("");
    }
  }, []);

  const onClear = React.useCallback(() => {
    setFilterValue("");
    setPage(1);
  }, []);

  const onStatusFilterChange = React.useCallback((status: string) => {
    setStatusFilter(status);
    setPage(1);
  }, []);

  const onEndpointFilterChange = React.useCallback((endpointId: string) => {
    setEndpointFilter(endpointId);
    setPage(1);
  }, []);

  const onTagFilterChange = React.useCallback((tagId: string) => {
    setTagFilter(tagId);
    setPage(1);
  }, []);

  // 处理批量操作
  const handleBulkAction = (action: string) => {
    switch(action) {
      case 'start':
        executeBatchStart();
        break;
      case 'stop':
        executeBatchStop();
        break;
      case 'restart':
        executeBatchRestart();
        break;
      case 'delete':
        showBatchDeleteModal();
        break;
      case 'export':
        handleExportConfig();
        break;
      default:
        break;
    }
  };

  return (
    <>
      <div className="p-4 md:p-0">
        {/* 页面顶部：标题 */}
        <div className="mb-6">
        </div>

        <Flex direction="col" className="border border-default-200 rounded-lg transition-all duration-300 hover:shadow-sm">
          <TunnelToolBox 
            filterValue={filterValue}
            statusFilter={statusFilter}
            endpointFilter={endpointFilter}
            loading={loading}
            onSearchChange={onSearchChange}
            onClear={onClear}
            onStatusFilterChange={onStatusFilterChange}
            onEndpointFilterChange={onEndpointFilterChange}
            onRefresh={fetchTunnels}
            selectedCount={getSelectedCount()}
            onBulkAction={handleBulkAction}
            onTagManagement={handleTagManagement}
          />
          <Box className="w-full overflow-hidden">

            {/* 移动端：使用卡片布局 */}
            <div className="block md:hidden p-4 space-y-3">
              {loading ? (
                <div className="flex justify-center items-center py-16">
                  <div className="flex flex-col items-center gap-4">
                    <Spinner size="lg" />
                    <p className="text-default-500 text-sm">加载中...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-danger-50 flex items-center justify-center">
                      <FontAwesomeIcon icon={faRotateRight} className="text-2xl text-danger" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-danger text-sm font-medium">加载失败</p>
                      <p className="text-default-400 text-xs">{error}</p>
                    </div>
                    <Button 
                      color="danger" 
                      variant="flat" 
                      size="sm"
                      startContent={<FontAwesomeIcon icon={faRotateRight} />}
                      onClick={fetchTunnels}
                    >
                      重试
                    </Button>
                  </div>
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-default-100 flex items-center justify-center">
                      <FontAwesomeIcon icon={faEye} className="text-2xl text-default-400" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-default-500 text-sm font-medium">暂无实例</p>
                      <p className="text-default-400 text-xs">您还没有创建任何实例</p>
                    </div>
                  </div>
                </div>
              ) : (
                items.map((tunnel) => (
                  <div key={tunnel.id} className="border border-default-200 rounded-lg p-3 space-y-2 bg-background">
                    {/* 头部：名称和状态 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Chip 
                          variant="flat" 
                          color={tunnel.type === "服务端" ? "primary" : "secondary"}
                          size="sm"
                          className="text-xs"
                        >
                          {tunnel.type}
                        </Chip>
                        <div className="flex items-center gap-1 min-w-0">
                          <Tooltip content={tunnel.name} size="sm">
                            <span className="font-semibold text-sm truncate max-w-[120px]">{tunnel.name}</span>
                          </Tooltip>
                          <Tooltip content="修改名称" size="sm">
                            <FontAwesomeIcon 
                              icon={faPen} 
                              className="text-[10px] text-default-400 hover:text-default-500 cursor-pointer" 
                              onClick={() => handleEditClick(tunnel)}
                            />
                          </Tooltip>
                        </div>
                      </div>
                      <Chip 
                        variant="flat"
                        color={tunnel.status.type}
                        size="sm"
                        className="text-xs"
                      >
                        {tunnel.status.text}
                      </Chip>
                    </div>

                    {/* 主控信息 */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-default-500 w-12 flex-shrink-0">主控:</span>
                        <Chip 
                          variant="bordered" 
                          color="default"
                          size="sm"
                          className="text-xs"
                        >
                          {tunnel.endpoint}
                        </Chip>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-default-500 w-12 flex-shrink-0">实例:</span>
                        <span className="text-xs font-mono text-default-600 truncate">
                          {formatAddress(tunnel.tunnelAddress, tunnel.tunnelPort)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-default-500 w-12 flex-shrink-0">目标:</span>
                        <span className="text-xs font-mono text-default-600 truncate">
                          {formatAddress(tunnel.targetAddress, tunnel.targetPort)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-default-500 w-12 flex-shrink-0">流量:</span>
                        <div className="flex-1">
                          <TrafficInfo traffic={tunnel.traffic} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-default-500 w-12 flex-shrink-0">标签:</span>
                        <div className="flex items-center gap-2">
                          {tunnel.tag && tunnel.tag.id ? (
                            <Tooltip content="点击更改标签" size="sm">
                              <Chip 
                                variant="flat"
                                size="sm"
                                color="primary"
                                className="text-xs cursor-pointer hover:opacity-80"
                                onClick={() => handleTagClick(tunnel)}
                              >
                                {tunnel.tag.name}
                              </Chip>
                            </Tooltip>
                          ) : (
                            <Tooltip content="设置标签" size="sm">
                              <FontAwesomeIcon 
                                icon={faTag} 
                                className="text-[10px] text-default-400 hover:text-default-500 cursor-pointer" 
                                onClick={() => handleTagClick(tunnel)}
                              />
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex justify-end gap-1 pt-2 border-t border-default-100">
                      <Tooltip content="查看实例" size="sm">
                        <Button
                          isIconOnly
                          variant="light"
                          size="sm"
                          color="primary"
                          onClick={() => router.push(`/tunnels/details?id=${tunnel.id}`)}
                          startContent={<FontAwesomeIcon icon={faEye} className="text-xs" />}
                        />
                      </Tooltip>
                      <Tooltip content={tunnel.status.type === "success" ? "停止实例" : "启动实例"} size="sm">
                        <Button
                          isIconOnly
                          variant="light"
                          size="sm"
                          color={tunnel.status.type === "success" ? "warning" : "success"}
                          onClick={() => handleToggleStatus(tunnel)}
                          startContent={<FontAwesomeIcon icon={tunnel.status.type === "success" ? faStop : faPlay} className="text-xs" />}
                        />
                      </Tooltip>
                      <Tooltip content="重启实例" size="sm">
                        <Button
                          isIconOnly
                          variant="light"
                          size="sm"
                          color="secondary"
                          onClick={() => handleRestart(tunnel)}
                          isDisabled={tunnel.status.type !== "success"}
                          startContent={<FontAwesomeIcon icon={faRotateRight} className="text-xs" />}
                        />
                      </Tooltip>
                      <Tooltip content="编辑实例" size="sm">
                        <Button
                          isIconOnly
                          variant="light"
                          size="sm"
                          color="default"
                          onClick={()=>{ setEditTunnel(tunnel); setEditModalOpen(true);} }
                          startContent={<FontAwesomeIcon icon={faPen} className="text-xs" />}
                        />
                      </Tooltip>
                      <Tooltip content="删除实例" size="sm">
                        <Button
                          isIconOnly
                          variant="light"
                          size="sm"
                          color="danger"
                          onClick={() => handleDeleteClick(tunnel)}
                          startContent={<FontAwesomeIcon icon={faTrash} className="text-xs" />}
                        />
                      </Tooltip>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 标签筛选器 */}
            {tags.length > 0 && (
              <div className="px-3 md:px-4 pb-3">
                <div className="flex flex-wrap gap-2">
                  <Chip
                    color={tagFilter === "all" ? "primary" : "default"}
                    className="cursor-pointer rounded-md"
                    onClick={() => onTagFilterChange("all")}
                  >
                    所有
                  </Chip>
                  {tags.map((tag) => (
                    <Chip
                      key={tag.id}
                      color={tagFilter === String(tag.id) ? "primary" : "default"}
                      
                      className="cursor-pointer rounded-md"
                      onClick={() => onTagFilterChange(String(tag.id))}
                    >
                      {tag.name}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {/* 桌面端：使用表格布局 */}
            <div className="hidden md:block">
              {loading || error || items.length === 0 ? (
                <div className="min-h-[400px] flex items-center justify-center py-16">
                  {loading ? (
                    <div className="flex flex-col items-center gap-4">
                      <Spinner size="lg" />
                      <p className="text-default-500">加载中...</p>
                    </div>
                  ) : error ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-20 h-20 rounded-full bg-danger-50 flex items-center justify-center">
                        <FontAwesomeIcon icon={faRotateRight} className="text-3xl text-danger" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-danger text-base font-medium">加载失败</p>
                        <p className="text-default-400 text-sm">{error}</p>
                      </div>
                      <Button 
                        color="danger" 
                        variant="flat"
                        startContent={<FontAwesomeIcon icon={faRotateRight} />}
                        onClick={fetchTunnels}
                      >
                        重试
                      </Button>
                    </div>
                                  ) : (
                  <div className="flex flex-col items-center justify-center gap-4 text-center">
                    <div className="w-20 h-20 rounded-full bg-default-100 flex items-center justify-center">
                      <FontAwesomeIcon icon={faEye} className="text-3xl text-default-400" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-default-500 text-base font-medium">暂无实例</p>
                      <p className="text-default-400 text-sm">您还没有创建任何实例</p>
                    </div>
                  </div>
                )}
                </div>
              ) : (
                <Table
                  shadow="none"
                  selectionMode="multiple"
                  selectedKeys={selectedKeys}
                  onSelectionChange={setSelectedKeys}
                  {...(sortDescriptor.column ? { 
                    sortDescriptor: { 
                      column: sortDescriptor.column, 
                      direction: sortDescriptor.direction 
                    },
                    onSortChange: handleSortChange 
                  } : {})}
                  aria-label="实例实例表格"
                  className="min-w-full"
                  classNames={{
                    th: "text-xs md:text-sm",
                    td: "py-3",
                    // 调整checkbox列宽度
                    thead: "[&>tr>th:first-child]:w-12 [&>tr>th:first-child]:min-w-12",
                    tbody: "[&>tr>td:first-child]:w-12 [&>tr>td:first-child]:min-w-12"
                  }}
                >
                  <TableHeader columns={columns}>
                    {(column) => (
                      <TableColumn
                        key={column.key}
                        hideHeader={false}
                        className={
                          column.key === "actions" ? "w-[140px]" : 
                          column.key === "traffic" ? "w-[160px]" : 
                          column.key === "type" ? "w-[80px]" :
                          column.key === "endpoint" ? "w-[120px]" : ""
                        }
                        allowsSorting={column.sortable}
                      >
                        {column.label}
                      </TableColumn>
                    )}
                  </TableHeader>
                  <TableBody>
                    {items.map((tunnel) => (
                      <TableRow key={tunnel.id}>
                        {/* 类型列 */}
                        <TableCell>
                          <Chip 
                            variant="flat" 
                            color={tunnel.type === "服务端" ? "primary" : "secondary"}
                            size="sm"
                            classNames={{
                              base: "text-xs md:text-sm"
                            }}
                          >
                            {tunnel.type}
                          </Chip>
                        </TableCell>
                        
                        {/* 名称列 */}
                        <TableCell>
                          <Flex align="center" className="gap-2">
                            <Tooltip content={tunnel.name} size="sm">
                              <Box className="text-xs md:text-sm font-semibold truncate max-w-[80px] md:max-w-[120px]">
                                {tunnel.name}
                              </Box>
                            </Tooltip>
                            <Tooltip content="修改名称" size="sm">
                              <FontAwesomeIcon 
                                icon={faPen} 
                                className="text-[10px] text-default-400 hover:text-default-500 cursor-pointer" 
                                onClick={() => handleEditClick(tunnel)}
                              />
                            </Tooltip>
                          </Flex>
                        </TableCell>
                        
                        {/* 主控列 */}
                        <TableCell>
                          <Chip 
                            variant="bordered" 
                            color="default"
                            size="sm"
                            classNames={{
                              base: "text-xs md:text-sm max-w-[100px] md:max-w-none",
                              content: "truncate"
                            }}
                          >
                            {tunnel.endpoint}
                          </Chip>
                        </TableCell>
                        
                        {/* 隧道地址列 */}
                        <TableCell className="text-xs md:text-sm text-default-600 font-mono truncate max-w-[150px] md:max-w-none">
                          {formatAddress(tunnel.tunnelAddress, tunnel.tunnelPort)}
                        </TableCell>
                        
                        {/* 目标地址列 */}
                        <TableCell className="text-xs md:text-sm text-default-600 font-mono truncate max-w-[150px] md:max-w-none">
                          {formatAddress(tunnel.targetAddress, tunnel.targetPort)}
                        </TableCell>
                        
                        {/* 状态列 */}
                        <TableCell>
                          <Chip 
                            variant="flat"
                            color={tunnel.status.type}
                            size="sm"
                            classNames={{
                              base: "text-xs md:text-sm"
                            }}
                          >
                            {tunnel.status.text}
                          </Chip>
                        </TableCell>
                        
                        {/* 标签列 */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {tunnel.tag && tunnel.tag.id ? (
                              <Tooltip content="点击更改标签" size="sm">
                                                              <Chip 
                                variant="flat"
                                size="sm"
                                color="primary"
                                classNames={{
                                  base: "text-xs md:text-sm cursor-pointer hover:opacity-80"
                                }}
                                onClick={() => handleTagClick(tunnel)}
                              >
                                  {tunnel.tag.name}
                                </Chip>
                              </Tooltip>
                            ) : (
                              <Tooltip content="设置标签" size="sm">
                                <FontAwesomeIcon 
                                  icon={faTag} 
                                  className="text-[10px] text-default-400 hover:text-default-500 cursor-pointer" 
                                  onClick={() => handleTagClick(tunnel)}
                                />
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        
                        {/* 流量列 */}
                        <TableCell className="text-xs md:text-sm text-default-600 font-mono truncate min-w-[150px]">
                          <TrafficInfo traffic={tunnel.traffic} />
                        </TableCell>
                        
                        {/* 操作列 */}
                        <TableCell>
                          <div className="flex justify-center gap-1">
                            <Tooltip content="查看实例" size="sm">
                              <Button
                                isIconOnly
                                variant="light"
                                size="sm"
                                color="primary"
                                onClick={() => router.push(`/tunnels/details?id=${tunnel.id}`)}
                                startContent={<FontAwesomeIcon icon={faEye} className="text-xs" />}
                              />
                            </Tooltip>
                            <Tooltip content={tunnel.status.type === "success" ? "停止实例" : "启动实例"} size="sm">
                              <Button
                                isIconOnly
                                variant="light"
                                size="sm"
                                color={tunnel.status.type === "success" ? "warning" : "success"}
                                onClick={() => handleToggleStatus(tunnel)}
                                startContent={<FontAwesomeIcon icon={tunnel.status.type === "success" ? faStop : faPlay} className="text-xs" />}
                              />
                            </Tooltip>
                            <Tooltip content="重启实例" size="sm">
                              <Button
                                isIconOnly
                                variant="light"
                                size="sm"
                                color="secondary"
                                onClick={() => handleRestart(tunnel)}
                                isDisabled={tunnel.status.type !== "success"}
                                startContent={<FontAwesomeIcon icon={faRotateRight} className="text-xs" />}
                              />
                            </Tooltip>
                            <Tooltip content="编辑实例" size="sm">
                              <Button
                                isIconOnly
                                variant="light"
                                size="sm"
                                color="warning"
                                onClick={()=>{ setEditTunnel(tunnel); setEditModalOpen(true);} }
                                startContent={<FontAwesomeIcon icon={faPen} className="text-xs" />}
                              />
                            </Tooltip>
                            <Tooltip content="删除实例" size="sm">
                              <Button
                                isIconOnly
                                variant="light"
                                size="sm"
                                color="danger"
                                onClick={() => handleDeleteClick(tunnel)}
                                startContent={<FontAwesomeIcon icon={faTrash} className="text-xs" />}
                              />
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Box>
          
          {/* 分页器 - 响应式优化 */}
          {!loading && !error && filteredItems.length > 0 && (
            <Flex justify="between" align="center" className="w-full px-3 md:px-4 py-3 gap-2 md:gap-4 flex-col lg:flex-row">
              {/* 左侧：统计信息 */}
              <Box className="text-xs md:text-sm text-default-500 order-3 lg:order-1">
                <span>共 {filteredItems.length} 个实例</span>
              </Box>
              
              {/* 中间：分页器 */}
              <div className="order-1 lg:order-2">
                <Pagination 
                  loop 
                  total={pages || 1} 
                  page={page} 
                  onChange={setPage}
                  size="sm"
                  showControls
                  classNames={{
                    cursor: "text-xs md:text-sm",
                    item: "text-xs md:text-sm"
                  }}
                />
              </div>

              {/* 右侧：每页数量选择器 */}
              <div className="flex items-center gap-2 order-2 lg:order-3">
                <span className="text-xs text-default-400">每页显示:</span>
                <Select
                  size="sm"
                  className="w-20"
                  selectedKeys={[String(rowsPerPage)]}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as string;
                    const newRowsPerPage = Number(value);
                    setRowsPerPage(newRowsPerPage);
                    setPage(1);
                    // 保存到 localStorage
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('tunnels-rows-per-page', String(newRowsPerPage));
                    }
                  }}
                >
                  <SelectItem key="10">10</SelectItem>
                  <SelectItem key="20">20</SelectItem>
                  <SelectItem key="50">50</SelectItem>
                  <SelectItem key="100">100</SelectItem>
                </Select>
              </div>
            </Flex>
          )}
        </Flex>
      </div>

      {/* 删除确认模态框 */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faTrash} className="text-danger" />
                  确认删除
                </div>
              </ModalHeader>
              <ModalBody>
                {deleteModalTunnel && (
                  <>
                    <p className="text-default-600">
                      您确定要删除实例 <span className="font-semibold text-foreground">"{deleteModalTunnel.name}"</span> 吗？
                    </p>
                    <p className="text-small text-warning">
                      ⚠️ 此操作不可撤销，实例的所有配置和数据都将被永久删除。
                    </p>
                    {/* 选择是否移入回收站 */}
                    <div className="pt-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
                        <input
                          type="checkbox"
                          className="form-checkbox h-4 w-4 text-primary"
                          checked={moveToRecycle}
                          onChange={(e) => setMoveToRecycle(e.target.checked)}
                        />
                        <span>删除后历史记录移至回收站</span>
                      </label>
                    </div>
                  </>
                )}
              </ModalBody>
              <ModalFooter>
                <Button color="default" variant="light" onPress={onClose}>
                  取消
                </Button>
                <Button 
                  color="danger" 
                  onPress={() => {
                    confirmDelete();
                    onClose();
                  }}
                  startContent={<FontAwesomeIcon icon={faTrash} />}
                >
                  确认删除
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* 编辑名称模态框 */}
      <Modal isOpen={isEditModalOpen} onOpenChange={setIsEditModalOpen} placement="center">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faPen} className="text-primary" />
                  修改实例名称
                </div>
              </ModalHeader>
              <ModalBody>
                <Input
                  label="实例名称"
                  placeholder="请输入新的实例名称"
                  value={newTunnelName}
                  onValueChange={setNewTunnelName}
                  variant="bordered"
                  isDisabled={isEditLoading}
                />
              </ModalBody>
              <ModalFooter>
                <Button 
                  color="default" 
                  variant="light" 
                  onPress={onClose}
                  isDisabled={isEditLoading}
                >
                  取消
                </Button>
                <Button 
                  color="primary" 
                  onPress={handleEditSubmit}
                  isLoading={isEditLoading}
                >
                  确认修改
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Quick Edit Modal */}
      {editModalOpen && editTunnel && (
        <QuickCreateTunnelModal
          isOpen={editModalOpen}
          onOpenChange={(open)=>setEditModalOpen(open)}
          mode="edit"
          editData={editTunnel as any}
          onSaved={()=>{ setEditModalOpen(false); fetchTunnels(); }}
        />
      )}

      {/* 快建实例模态框 */}
      <QuickCreateTunnelModal
        isOpen={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        onSaved={() => { setQuickCreateOpen(false); fetchTunnels(); }}
      />

      {/* 批量创建模态框 */}
      <BatchCreateModal
        isOpen={batchCreateOpen}
        onOpenChange={setBatchCreateOpen}
        onSaved={() => { setBatchCreateOpen(false); fetchTunnels(); }}
      />

      {/* 手搓创建模态框 */}
      <ManualCreateTunnelModal
        isOpen={manualCreateOpen}
        onOpenChange={setManualCreateOpen}
        onSaved={() => { setManualCreateOpen(false); fetchTunnels(); }}
      />

      {/* 批量删除确认模态框 */}
      <Modal isOpen={batchDeleteModalOpen} onOpenChange={setBatchDeleteModalOpen} placement="center">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faTrash} className="text-danger" />
                  确认批量删除
                </div>
              </ModalHeader>
              <ModalBody>
                <p className="text-default-600">
                  您确定要删除选中的 <span className="font-semibold text-foreground">{getSelectedCount()}</span> 个实例吗？
                </p>
                <p className="text-small text-warning">
                  ⚠️ 此操作不可撤销，选中实例的所有配置和数据都将被永久删除。
                </p>
                {/* 选择是否移入回收站 */}
                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
                    <input
                      type="checkbox"
                      className="form-checkbox h-4 w-4 text-primary"
                      checked={batchMoveToRecycle}
                      onChange={(e) => setBatchMoveToRecycle(e.target.checked)}
                    />
                    <span>删除后历史记录移至回收站</span>
                  </label>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="default" variant="light" onPress={onClose}>
                  取消
                </Button>
                <Button 
                  color="danger" 
                  onPress={executeBatchDelete}
                  startContent={<FontAwesomeIcon icon={faTrash} />}
                >
                  确认删除
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* 导出配置模态框 */}
      <Modal 
        isOpen={exportModalOpen} 
        onOpenChange={setExportModalOpen} 
        placement="center"
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faDownload} className="text-primary" />
                  导出配置规则
                </div>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <p className="text-default-600 text-sm">
                    已选择 {getSelectedCount()} 个实例的配置规则，格式符合批量创建规范：
                  </p>
                  <Code className="w-full p-4 max-h-96 overflow-auto">
                    <pre className="text-sm whitespace-pre-wrap">{exportConfig}</pre>
                  </Code>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="default" variant="light" onPress={onClose}>
                  关闭
                </Button>
                <Button 
                  color="primary" 
                  onPress={copyExportConfig}
                  startContent={<FontAwesomeIcon icon={faCopy} />}
                >
                  复制配置
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* 手动复制模态框 */}
      <ManualCopyModal
        isOpen={isManualCopyOpen}
        onOpenChange={(open) => setIsManualCopyOpen(open)}
        text={manualCopyText}
      />

      {/* 标签管理模态框 */}
      <TagManagementModal
        isOpen={tagManagementModalOpen}
        onOpenChange={setTagManagementModalOpen}
        onSaved={handleTagSaved}
      />

      {/* 简化标签设置模态框 */}
      <SimpleTagModal
        isOpen={simpleTagModalOpen}
        onOpenChange={setSimpleTagModalOpen}
        tunnelId={currentTunnelForTag?.id?.toString() || ""}
        currentTag={currentTunnelForTag?.tag}
        onSaved={handleTagSaved}
      />
    </>
  );
} 