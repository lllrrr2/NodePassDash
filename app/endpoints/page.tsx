"use client";

import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Chip,
  Divider,
  Input,
  Link,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Skeleton,
  cn,
  useDisclosure,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Tabs,
  Tab,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Tooltip
} from "@heroui/react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";

import { addToast } from "@heroui/toast";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faPlus, 
  faServer, 
  faBullseye, 
  faEye, 
  faEdit, 
  faTrash, 
  faEyeSlash,
  faLink,
  faTimesCircle,
  faRotateRight,
  faFileImport,
  faFileDownload,
  faPlug,
  faPlugCircleXmark,
  faPen,
  faWifi,
  faSpinner,
  faCopy,
  faEllipsisVertical,
  faGrip,
  faTable,
  faFileLines,
  faLayerGroup,
  faSync,
  faKey
} from "@fortawesome/free-solid-svg-icons";
import AddEndpointModal from "./components/add-endpoint-modal";
import RenameEndpointModal from "./components/rename-endpoint-modal";
import EditApiKeyModal from "./components/edit-apikey-modal";
import { buildApiUrl } from '@/lib/utils';
import { copyToClipboard } from '@/lib/utils/clipboard';
import ManualCopyModal from '@/components/ui/manual-copy-modal';
import { useGlobalVisibility } from '@/lib/hooks/use-global-visibility';
// 本地定义 EndpointStatus 枚举，后端通过 API 返回字符串
type EndpointStatus = 'ONLINE' | 'OFFLINE' | 'FAIL' | 'DISCONNECT';
// 后端返回的 Endpoint 基础结构
interface EndpointBase {
  id: number;
  name: string;
  url: string;
  status: EndpointStatus;
}

interface EndpointWithRelations extends EndpointBase {
  tunnelInstances: Array<{
    id: string;
    status: string;
  }>;
  responses: Array<{
    response: string;
  }>;
}

interface FormattedEndpoint extends EndpointWithRelations {
  apiPath: string;
  apiKey: string;
  tunnelCount: number;
  activeInstances: number;
  createdAt: Date;
  updatedAt: Date;
  lastCheck: Date;
  lastResponse: string | null;
  ver?: string; // 添加版本字段
}

interface EndpointFormData {
  name: string;
  url: string;
  apiPath: string;
  apiKey: string;
}

export default function EndpointsPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [endpoints, setEndpoints] = useState<FormattedEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [deleteModalEndpoint, setDeleteModalEndpoint] = useState<FormattedEndpoint | null>(null);
  const [showApiKey, setShowApiKey] = useState<{[key: string]: boolean}>({});
  
  // 使用全局可见性Hook
  const globalVisibility = useGlobalVisibility();
  const { isOpen: isImportOpen, onOpen: onImportOpen, onOpenChange: onImportOpenChange } = useDisclosure();


  const {isOpen: isAddOpen, onOpen: onAddOpen, onOpenChange: onAddOpenChange} = useDisclosure();
  const {isOpen: isDeleteOpen, onOpen: onDeleteOpen, onOpenChange: onDeleteOpenChange} = useDisclosure();
  const {isOpen: isRenameOpen, onOpen: onRenameOpen, onOpenChange: onRenameOpenChange} = useDisclosure();
  const {isOpen: isEditApiKeyOpen, onOpen: onEditApiKeyOpen, onOpenChange: onEditApiKeyOpenChange} = useDisclosure();
  const [selectedEndpoint, setSelectedEndpoint] = useState<FormattedEndpoint | null>(null);
  // Next.js 路由
  const router = useRouter();
  // 视图模式：card | table，初始化时从 localStorage 读取
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('endpointsViewMode');
      if (saved === 'card' || saved === 'table') {
        return saved;
      }
    }
    return 'card';
  });

  // 当 viewMode 变化时写入 localStorage，保持持久化
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('endpointsViewMode', viewMode);
    }
  }, [viewMode]);

  // 获取主控列表
  const fetchEndpoints = async () => {
    try {
      setLoading(true);
      const response = await fetch(buildApiUrl('/api/endpoints'));
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
      setLoading(false);
    }
  };

  // 应用启动时执行主控列表获取
  useEffect(() => {
    const startupEndpoints = async () => {
      const endpoints = await fetchEndpoints();
    };
    
    startupEndpoints();
  }, []);

  const handleAddEndpoint = async (data: EndpointFormData) => {
    try {
      const response = await fetch(buildApiUrl('/api/endpoints'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('添加主控失败');

      addToast({
        title: "主控添加成功",
        description: `${data.name} 已成功添加到主控列表`,
        color: "success",
      });

      // 刷新主控列表
      fetchEndpoints();
    } catch (error) {
      addToast({
        title: "添加主控失败",
        description: "请检查输入信息后重试",
        color: "danger",
      });
    }
  };

  const handleDeleteClick = (endpoint: FormattedEndpoint) => {
    setDeleteModalEndpoint(endpoint);
    onDeleteOpen();
  };

  const handleDeleteEndpoint = async () => {
    if (!deleteModalEndpoint) return;

    try {
      const response = await fetch(buildApiUrl(`/api/endpoints/${deleteModalEndpoint.id}`), {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '删除失败');
      }

      // 刷新主控列表
      await fetchEndpoints();

      addToast({
        title: '成功',
        description: '删除成功',
        color: 'success'
      });
    } catch (error) {
      console.error('删除主控失败:', error);
      addToast({
        title: '错误',
        description: error instanceof Error ? error.message : '删除失败',
        color: 'danger'
      });
    }
    onDeleteOpenChange();
  };

  const toggleExpanded = (endpointId: number) => {
    setExpandedCard(prev => prev === endpointId ? null : endpointId);
  };

  const toggleApiKeyVisibility = (endpointId: number) => {
    setShowApiKey(prev => ({
      ...prev,
      [endpointId]: !prev[endpointId]
    }));
  };

  const handleReconnect = async (endpointId: number) => {
    try {
      // 调用 PATCH API 进行重连
      const response = await fetch(buildApiUrl('/api/endpoints'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          id: Number(endpointId),
          action: 'reconnect'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '重连失败');
      }

      const result = await response.json();

      addToast({
        title: "重连成功",
        description: result.message || "主控重连请求已发送，正在尝试建立连接...",
        color: "success",
      });

      // 立即刷新主控列表以获取最新状态
      await fetchEndpoints();

    } catch (error) {
      addToast({
        title: "重连失败",
        description: error instanceof Error ? error.message : "重连请求失败，请稍后重试",
        color: "danger",
      });
    }
  };

  const handleConnect = async (endpointId: number) => {
    try {
      // 调用 PATCH API 进行连接
      const response = await fetch(buildApiUrl('/api/endpoints'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          id: Number(endpointId),
          action: 'reconnect'  // 使用reconnect来建立连接
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '连接失败');
      }

      const result = await response.json();

      addToast({
        title: "连接成功",
        description: result.message || "主控连接请求已发送，正在尝试建立连接...",
        color: "success",
      });

      // 立即刷新主控列表以获取最新状态
      await fetchEndpoints();

    } catch (error) {
      addToast({
        title: "连接失败",
        description: error instanceof Error ? error.message : "连接请求失败，请稍后重试",
        color: "danger",
      });
    }
  };

  const handleDisconnect = async (endpointId: number) => {
    try {
      // 调用 PATCH API 进行断开连接
      const response = await fetch(buildApiUrl('/api/endpoints'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          id: Number(endpointId),
          action: 'disconnect'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '断开连接失败');
      }

      const result = await response.json();

      addToast({
        title: "断开连接成功",
        description: result.message || "主控连接已断开",
        color: "success",
      });

      // 立即刷新主控列表以获取最新状态
      await fetchEndpoints();

    } catch (error) {
      addToast({
        title: "断开连接失败",
        description: error instanceof Error ? error.message : "断开连接失败，请稍后重试",
        color: "danger",
      });
    }
  };
  const handleExportData = async () => {
    try {
      const response = await fetch('/api/data/export');
      if (!response.ok) {
        throw new Error('导出失败');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nodepassdash-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      addToast({
        title: "导出成功",
        description: "数据已成功导出到文件",
        color: "success",
      });
    } catch (error) {
      console.error('导出数据失败:', error);
      addToast({
        title: "导出失败",
        description: "导出数据时发生错误",
        color: "danger",
      });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/json') {
        addToast({
          title: "文件格式错误",
          description: "请选择 JSON 格式的文件",
          color: "danger",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleImportData = async () => {
    if (!selectedFile) {
      addToast({
        title: "请选择文件",
        description: "请先选择要导入的端点配置文件",
        color: "danger",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const fileContent = await selectedFile.text();
      const importData = JSON.parse(fileContent);

      const response = await fetch('/api/data/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(importData),
      });

      const result = await response.json();

      if (response.ok) {
        addToast({
          title: "导入成功",
          description: result.message,
          color: "success",
        });
        onImportOpenChange();
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        // 添加延迟以确保 Toast 消息能够显示
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        throw new Error(result.error || '导入失败');
      }
    } catch (error) {
      console.error('导入数据失败:', error);
      addToast({
        title: "导入失败",
        description: error instanceof Error ? error.message : "导入数据时发生错误",
        color: "danger",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  // 获取主控状态相关信息（直接从数据库数据）
  const getEndpointDisplayData = (endpoint: FormattedEndpoint) => {
    return {
      status: endpoint.status,
      tunnelCount: endpoint.tunnelCount || 0,
      canRetry: endpoint.status === 'FAIL' || endpoint.status === 'DISCONNECT'
    };
  };

  const getEndpointContent = (endpoint: FormattedEndpoint, isExpanded: boolean) => {
    const realTimeData = getEndpointDisplayData(endpoint);
    
    if (isExpanded) {
      return (
        <div className="h-full w-full items-start justify-center overflow-scroll px-4 pb-24 pt-8">
          <div className="space-y-4">
            <div>
              <label className="text-small text-default-500 mb-2 block">URL 地址</label>
              <Input
                value={endpoint.url}
                isReadOnly
                variant="bordered"
                size="sm"
              />
            </div>
            <div>
              <label className="text-small text-default-500 mb-2 block">API 前缀</label>
              <Input
                value={endpoint.apiPath}
                isReadOnly
                variant="bordered"
                size="sm"
              />
            </div>
            <div>
              <label className="text-small text-default-500 mb-2 block">API Key</label>
              <Input
                value={endpoint.apiKey}
                isReadOnly
                variant="bordered"
                size="sm"
                type={showApiKey[endpoint.id] ? "text" : "password"}
              />
            </div>
            
            {/* 连接状态和操作 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-small text-default-500">连接状态:</span>
                <Chip
                  size="sm"
                  variant="flat"
                  color={
                    realTimeData.status === 'ONLINE' ? 'success' : 
                    realTimeData.status === 'FAIL' ? 'danger' : 
                    realTimeData.status === 'DISCONNECT' ? 'default' : 'warning'
                  }
                  startContent={
                    <FontAwesomeIcon 
                      icon={
                        realTimeData.status === 'ONLINE' ? faLink : 
                        realTimeData.status === 'FAIL' ? faPlugCircleXmark : 
                        realTimeData.status === 'DISCONNECT' ? faPlugCircleXmark : faTimesCircle
                      } 
                      className="text-xs"
                    />
                  }
                >
                  {realTimeData.status === 'ONLINE' ? '在线' : 
                   realTimeData.status === 'FAIL' ? '异常' : 
                   realTimeData.status === 'DISCONNECT' ? '断开' : '离线'}
                </Chip>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-small text-default-500">实例数量:</span>
                <Chip size="sm" variant="flat" color="primary">
                  {realTimeData.tunnelCount} 个
                </Chip>
              </div>

              {/* 显示失败状态提示 */}
              {realTimeData.status === 'FAIL' && (
                <div className="p-2 bg-danger-50 rounded-lg">
                  <p className="text-tiny text-danger-600">主控连接失败，已停止重试</p>
                </div>
              )}
              
              {/* 显示断开状态提示 */}
              {realTimeData.status === 'DISCONNECT' && (
                <div className="p-2 bg-default-50 rounded-lg">
                  <p className="text-tiny text-default-600">主控已断开连接</p>
                </div>
              )}
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button size="sm" variant="bordered" startContent={<FontAwesomeIcon icon={faEdit} />}>
                编辑
              </Button>
              <Button size="sm" variant="bordered" startContent={<FontAwesomeIcon icon={faEye} />}>
                查看实例
              </Button>
              {realTimeData.canRetry && (
                <Button 
                  size="sm" 
                  variant="bordered" 
                  color="primary"
                  startContent={<FontAwesomeIcon icon={faRotateRight} />}
                  onPress={() => handleReconnect(endpoint.id)}
                >
                  重新连接
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between h-full w-full">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon 
              icon={faBullseye} 
              className={
                realTimeData.status === 'ONLINE' ? "text-success-600" : 
                realTimeData.status === 'FAIL' ? "text-danger-600" :
                realTimeData.status === 'DISCONNECT' ? "text-default-400" : "text-warning-600"
              } 
            />
          <p className="text-small text-default-500">
            {realTimeData.tunnelCount ? `${realTimeData.tunnelCount} 个实例` : "0 个实例"}
          </p>
        </div>
        <div className="flex items-center">
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Button isIconOnly variant="light" size="sm" onPress={(e)=>{(e as any).stopPropagation?.();}}>
                <FontAwesomeIcon icon={faEllipsisVertical} />
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Actions" onAction={(key)=>{
                switch(key){
                  case 'toggle':
                    if(realTimeData.status==='ONLINE') handleDisconnect(endpoint.id); else handleConnect(endpoint.id);
                    break;
                  case 'rename':
                    handleCardClick(endpoint);
                    break;
                  case 'editApiKey':
                    handleEditApiKeyClick(endpoint);
                    break;
                  case 'copy':
                    handleCopyConfig(endpoint);
                    break;
                  case 'addTunnel':
                    handleAddTunnel(endpoint);
                    break;
                  case 'refresTunnel':
                    handleRefreshTunnels(endpoint.id);
                    break;
                  case 'delete':
                    handleDeleteClick(endpoint);
                    break;
                }}}>
              <DropdownItem key="addTunnel" startContent={<FontAwesomeIcon icon={faPlus} fixedWidth/>} className="text-primary" color="primary">添加实例</DropdownItem>
              <DropdownItem key="refresTunnel" startContent={<FontAwesomeIcon icon={faSync} fixedWidth/>} className="text-secondary" color="secondary">同步实例</DropdownItem>
              <DropdownItem key="rename" startContent={<FontAwesomeIcon icon={faPen} fixedWidth/>} className="text-warning" color="warning">重命名</DropdownItem>
              <DropdownItem key="editApiKey" startContent={<FontAwesomeIcon icon={faKey} fixedWidth/>} className="text-warning" color="warning">修改密钥</DropdownItem>
              <DropdownItem key="copy" startContent={<FontAwesomeIcon icon={faCopy} fixedWidth/>} className="text-success" color="success">复制配置</DropdownItem>
              <DropdownItem 
                key="toggle" 
                startContent={<FontAwesomeIcon icon={realTimeData.status==='ONLINE'?faPlugCircleXmark:faPlug} fixedWidth/> }
                color={realTimeData.status==='ONLINE' ? 'warning' : 'success'}
                className={realTimeData.status==='ONLINE' ? 'text-warning' : 'text-success'}
              >
                {realTimeData.status==='ONLINE'?'断开连接':'连接主控'}
              </DropdownItem>
              <DropdownItem key="delete" className="text-danger" color="danger" startContent={<FontAwesomeIcon icon={faTrash} fixedWidth/>}>删除主控</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>
    );
  };

  const handleCardClick = (endpoint: FormattedEndpoint) => {
    setSelectedEndpoint(endpoint);
    onRenameOpen();
  };

  const handleRename = async (newName: string) => {
    if (!selectedEndpoint?.id) return;

    try {
      const response = await fetch(buildApiUrl(`/api/endpoints/${selectedEndpoint.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newName,
          action: 'rename'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '重命名失败');
      }

      addToast({
        title: "重命名成功",
        description: `主控名称已更新为 "${newName}"`,
        color: "success",
      });

      // 刷新主控列表
      fetchEndpoints();
    } catch (error) {
      addToast({
        title: "重命名失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        color: "danger",
      });
    }
  };

  // 处理编辑主控
  const handleEdit = async (endpointId: string, data: EndpointFormData) => {
    try {
      const response = await fetch(buildApiUrl(`/api/endpoints/${endpointId}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '更新失败');
      }

      // 刷新主控列表
      await fetchEndpoints();

      addToast({
        title: '成功',
        description: '更新成功',
        color: 'success'
      });
    } catch (error) {
      console.error('更新主控失败:', error);
      addToast({
        title: '错误',
        description: error instanceof Error ? error.message : '更新失败',
        color: 'danger'
      });
    }
  };

  // 处理修改密钥
  const handleEditApiKey = async (newApiKey: string) => {
    if (!selectedEndpoint?.id) return;

    try {
      // 1. 先断开连接
      await handleDisconnect(selectedEndpoint.id);
      
      // 2. 更新密钥
      const response = await fetch(buildApiUrl(`/api/endpoints/${selectedEndpoint.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: newApiKey,
          action: 'editApiKey'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '修改密钥失败');
      }

      addToast({
        title: "密钥修改成功",
        description: "API Key 已更新，正在重新连接...",
        color: "success",
      });

      // 3. 刷新主控列表
      await fetchEndpoints();
      
      // 4. 重新连接
      setTimeout(async () => {
        await handleConnect(selectedEndpoint.id);
      }, 1000);

    } catch (error) {
      addToast({
        title: "修改密钥失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        color: "danger",
      });
      throw error; // 重新抛出错误以便模态框处理
    }
  };

  // 打开修改密钥弹窗
  const handleEditApiKeyClick = (endpoint: FormattedEndpoint) => {
    setSelectedEndpoint(endpoint);
    onEditApiKeyOpen();
  };

  // 打开添加隧道弹窗
  const {isOpen: isAddTunnelOpen, onOpen: onAddTunnelOpen, onOpenChange: onAddTunnelOpenChange} = useDisclosure();
  const [tunnelUrl, setTunnelUrl] = useState('');
  const [tunnelName, setTunnelName] = useState('');

  function handleAddTunnel(endpoint: FormattedEndpoint) {
    setSelectedEndpoint(endpoint);
    setTunnelUrl('');
    setTunnelName('');
    onAddTunnelOpen();
  }

  // 提交添加隧道
  const handleSubmitAddTunnel = async () => {
    if(!selectedEndpoint) return;
    if(!tunnelUrl.trim()) {
      addToast({title:'请输入 URL', description:'隧道 URL 不能为空', color:'warning'});
      return;
    }
    try {
      const res = await fetch(buildApiUrl('/api/tunnels/quick'), {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({endpointId: selectedEndpoint.id, url: tunnelUrl.trim(), name: tunnelName.trim()})
      });
      const data = await res.json();
      if(!res.ok || !data.success){
        throw new Error(data.error || '创建隧道失败');
      }
      addToast({title:'创建成功', description: data.message || '隧道已创建', color:'success'});
      onAddTunnelOpenChange();
    } catch(err){
      addToast({title:'创建失败', description: err instanceof Error ? err.message : '无法创建隧道', color:'danger'});
    }
  };

  // 复制配置到剪贴板
  function handleCopyConfig(endpoint: FormattedEndpoint) {
    const cfg = `API URL: ${endpoint.url}${endpoint.apiPath}\nAPI KEY: ${endpoint.apiKey}`;
    copyToClipboard(cfg, '配置已复制到剪贴板', showManualCopyModal);
  }

  // 手动复制模态框状态
  const [manualCopyText, setManualCopyText] = useState<string>('');
  const {isOpen: isManualCopyOpen, onOpen: onManualCopyOpen, onOpenChange: onManualCopyOpenChange} = useDisclosure();
  
  const showManualCopyModal = (text: string) => {
    setManualCopyText(text);
    onManualCopyOpen();
  };

  // 复制安装脚本到剪贴板
  function handleCopyInstallScript() {
    const cmd = 'bash <(wget -qO- https://run.nodepass.eu/np.sh)';
    copyToClipboard(cmd, '安装脚本已复制到剪贴板', showManualCopyModal);
  }

  // 刷新指定端点的隧道信息
  const handleRefreshTunnels = async (endpointId: number) => {
    try {
      const res = await fetch(buildApiUrl('/api/endpoints'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: endpointId, action: 'refresTunnel' })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '刷新失败');
      }
      addToast({ title: '刷新成功', description: data.message || '隧道信息已刷新', color: 'success' });
      await fetchEndpoints();
    } catch (err) {
      addToast({ title: '刷新失败', description: err instanceof Error ? err.message : '刷新请求失败', color: 'danger' });
    }
  };

  return (
    <div className="max-w-7xl py-6 mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-2 md:gap-0">
        <div className="flex items-center gap-2 md:gap-4">
          <h1 className="text-2xl font-bold">主控管理</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-2 md:mt-0">
          <Button 
            variant="flat"
            startContent={ <FontAwesomeIcon icon={faFileDownload} />}
            onPress={handleExportData}
          >
            导出数据
          </Button>
          <Button 
            variant="flat"
            startContent={ <FontAwesomeIcon icon={faFileImport} />}
            onPress={onImportOpen}
          >
            导入数据
          </Button>
          <Button 
            variant="flat"
            startContent={<FontAwesomeIcon icon={faCopy} />}
            onPress={handleCopyInstallScript}
          >
            安装脚本
          </Button>
          <Button 
            variant="flat"
            startContent={  <FontAwesomeIcon icon={faRotateRight} />}
            onPress={async ()=>{await fetchEndpoints();}}
              >
              刷新
          </Button>
          <Tabs
            selectedKey={viewMode}
            onSelectionChange={(key)=>setViewMode(key as 'card' | 'table')}
            aria-label="布局切换"
            className="w-auto"
          >
            <Tab 
              key="card" 
              title={
                <Tooltip content="卡片视图" >
                  <div>
                    <FontAwesomeIcon icon={faGrip} />
                  </div>
                </Tooltip>
              } 
            />
            <Tab 
              key="table" 
              title={
                <Tooltip content="表格视图" >
                  <div>
                    <FontAwesomeIcon icon={faTable} />
                  </div>
                </Tooltip>
              } 
            />
          </Tabs>
        </div>
      </div>

      {/* 根据视图模式渲染不同内容 */}
      {loading ? (
        /* Skeleton 加载状态 */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }, (_, index) => (
            <Card 
              key={index} 
              className="relative w-full h-[200px]"
            >
              {/* 状态按钮 Skeleton */}
              <div className="absolute right-4 top-6 z-10">
                <Skeleton className="h-8 w-12 rounded-full" />
              </div>

              {/* 主要内容区域 Skeleton */}
              <CardBody className="relative h-[140px] bg-gradient-to-br from-content1 to-default-100/50 p-6">
                <div className="flex items-center gap-3 mb-2 pr-20">
                  <Skeleton className="h-8 w-32 rounded-lg" />
                  <Skeleton className="h-6 w-16 rounded-lg" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-4 h-4 rounded" />
                    <Skeleton className="h-4 w-48 rounded-lg" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-4 h-4 rounded" />
                    <Skeleton className="h-4 w-60 rounded-lg" />
                  </div>
                </div>
              </CardBody>

              {/* 底部详情区域 Skeleton */}
              <CardFooter className="absolute bottom-0 h-[60px] bg-content1 px-6 border-t-1 border-default-100">
                <div className="flex items-center justify-between h-full w-full">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-4 h-4 rounded" />
                    <Skeleton className="h-4 w-16 rounded-lg" />
                  </div>
                  <Skeleton className="w-8 h-8 rounded" />
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : viewMode === 'card' ? (
        /* 卡片布局 */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {endpoints.map(endpoint => {
            const isExpanded = expandedCard === endpoint.id;
            const realTimeData = getEndpointDisplayData(endpoint);
            
            return (
              <Card 
                as="div"
                key={endpoint.id} 
                isPressable
                onPress={() => router.push(`/endpoints/details?id=${endpoint.id}`)}
                className="relative w-full h-[200px]"
              >
                {/* 状态按钮 */}
                <div
                  className="absolute right-4 top-6 z-10"
                >
                  <Chip
                    radius="full"
                    variant="flat"
                    color={
                      realTimeData.status === 'ONLINE' ? "success" : 
                      realTimeData.status === 'FAIL' ? "danger" : 
                      realTimeData.status === 'DISCONNECT' ? 'default' : 'warning'
                    }
                  >
                    {realTimeData.status === 'ONLINE' ? "在线" : 
                     realTimeData.status === 'FAIL' ? "异常" : 
                     realTimeData.status === 'DISCONNECT' ? '断开' : '离线'}
                  </Chip>
                </div>

                {/* 主要内容区域 */}
                <CardBody className="relative h-[140px] bg-gradient-to-br from-content1 to-default-100/50 p-6">
                  <div className="flex items-center gap-2 mb-2 pr-20">
                    <h2 className="inline bg-gradient-to-br from-foreground-800 to-foreground-500 bg-clip-text text-2xl font-semibold tracking-tight text-transparent dark:to-foreground-200">
                      {endpoint.name}
                    </h2>
                    {endpoint.ver && (
                      <Chip size="sm" variant="flat" className="text-xs">
                        {endpoint.ver}
                      </Chip>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-default-400">
                      <FontAwesomeIcon icon={faServer} />
                      <span className="text-small truncate">{endpoint.url}{endpoint.apiPath}</span>
                    </div>
                    <div className="flex items-center gap-2 text-default-400">
                      <FontAwesomeIcon 
                        icon={showApiKey[endpoint.id] ? faEyeSlash : faEye} 
                        className="text-xs cursor-pointer hover:text-primary w-4"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleApiKeyVisibility(endpoint.id);
                        }}
                      />
                      <span className="text-small font-mono flex-1 truncate">
                        {showApiKey[endpoint.id] ? endpoint.apiKey : "•••••••••••••••••••••••••••••••••"}
                      </span>
                    </div>
                  </div>
                </CardBody>

                {/* 底部详情区域 */}
                <CardFooter
                  className={cn(
                    "absolute bottom-0 h-[60px] overflow-visible bg-content1 px-6 duration-300 ease-in-out transition-all",
                    {
                      "h-full": isExpanded,
                      "border-t-1 border-default-100": !isExpanded,
                    },
                  )}
                >
                  {getEndpointContent(endpoint, isExpanded)}
                </CardFooter>
              </Card>
            );
          })}

          {/* 添加主控卡片 - 仅在非加载状态下显示 */}
          <Card 
            as="div"
            className="relative w-full h-[200px] cursor-pointer hover:shadow-lg transition-shadow border-2 border-dashed border-default-300 hover:border-primary"
            isPressable
            onPress={() => onAddOpen()}
          >
            <CardBody className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-default-50 to-default-100/50 p-6">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
                  <FontAwesomeIcon icon={faPlus} className="text-xl text-primary" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-default-700 mb-1">添加 API 主控</h3>
                  <p className="text-small text-default-500">点击添加新的主控配置</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      ) : (
        /* 表格布局 */
        <Table aria-label="API 主控列表"  className="mt-4">
          <TableHeader>
            <TableColumn key="id">ID</TableColumn>
            <TableColumn key="name" className="min-w-[140px]">名称</TableColumn>
            <TableColumn key="version" className="w-24">版本</TableColumn>
            <TableColumn key="url" className="min-w-[200px]">
              <div className="flex items-center gap-1">
                <span>URL</span>
                <FontAwesomeIcon 
                  icon={globalVisibility.endpoints.showUrlAll ? faEyeSlash : faEye}
                  className="text-xs cursor-pointer hover:text-primary" 
                  onClick={globalVisibility.endpoints.toggleShowUrlAll}
                />
              </div>
            </TableColumn>
            <TableColumn key="apikey" className="min-w-[220px]">
              <div className="flex items-center gap-1">
                <span>API Key</span>
                <FontAwesomeIcon 
                  icon={globalVisibility.endpoints.showApiKeyAll ? faEyeSlash : faEye}
                  className="text-xs cursor-pointer hover:text-primary" 
                  onClick={globalVisibility.endpoints.toggleShowApiKeyAll}
                />
              </div>
            </TableColumn>
            <TableColumn key="actions" className="w-52">操作</TableColumn>
          </TableHeader>
          <TableBody>
            {endpoints.length === 0 ? (
              <>
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4">暂无主控数据</TableCell>
                </TableRow>
                <TableRow key="add-row-empty">
                  <TableCell colSpan={6}>
                    <Button
                      variant="light"
                      className="w-full border-2 border-dashed border-default-300 hover:border-primary"
                      onPress={onAddOpen}
                    >
                      <FontAwesomeIcon icon={faPlus} className="mr-2" />
                      添加 API 主控
                    </Button>
                  </TableCell>
                </TableRow>
              </>
            ) : (
              <>
              {endpoints.map((ep) => {
                const realTimeData = getEndpointDisplayData(ep);
                return (
                  <TableRow key={ep.id}>
                    <TableCell>{ep.id}</TableCell>
                    <TableCell className="truncate min-w-[140px]">
                      <Tooltip 
                        content={
                          realTimeData.status === 'ONLINE' ? '在线' :
                          realTimeData.status === 'FAIL' ? '异常' :
                          realTimeData.status === 'DISCONNECT' ? '断开' : '离线'
                        }
                        size="sm"
                      >
                        <span className={
                          `inline-block w-2 h-2 rounded-full mr-2 cursor-help ${
                            realTimeData.status === 'ONLINE' ? 'bg-success-500' :
                            realTimeData.status === 'FAIL' ? 'bg-danger-500' :
                            realTimeData.status === 'DISCONNECT' ? 'bg-default-400' : 'bg-warning-500'
                          }`
                        } />
                      </Tooltip>
                      <span className="text-xs md:text-sm truncate max-w-[120px] md:max-w-none">
                        {ep.name}&nbsp;
                      </span>
                      <span className="text-default-400 text-small">[{realTimeData.tunnelCount}实例]</span> 
                      <Tooltip content="修改名称" size="sm">
                        <FontAwesomeIcon 
                          icon={faPen} 
                          className="text-[10px] text-default-400 hover:text-default-500 cursor-pointer ps-1" 
                          onClick={()=>handleCardClick(ep)}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell className="w-32">
                      <Chip size="sm" variant="flat" className="text-xs">
                      {ep.ver ?ep.ver:"unknown"}
                      </Chip> 
                    </TableCell>
                    <TableCell className="truncate min-w-[200px]">{globalVisibility.endpoints.showUrlAll ? `${ep.url}${ep.apiPath}` : '••••••••••••••••••••••••••'}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono truncate">
                        {globalVisibility.endpoints.showApiKeyAll ? ep.apiKey : '•••••••••••••••••••••••••••••••••'}
                      </span>
                    </TableCell>
                    <TableCell className="w-52">
                      <div className="flex items-center gap-1 justify-start">
                        {/* 查看详情 */}
                        <Tooltip content="查看详情">
                          <Button isIconOnly size="sm" variant="light" color="primary" onPress={()=>router.push(`/endpoints/details?id=${ep.id}`)}>
                            <FontAwesomeIcon icon={faEye} />
                          </Button>
                        </Tooltip>
                        {/* 添加实例 */}
                        {/* <Tooltip content="添加实例">
                          <Button isIconOnly size="sm" variant="light" color="primary" onPress={()=>handleAddTunnel(ep)}>
                            <FontAwesomeIcon icon={faPlus} />
                          </Button>
                        </Tooltip> */}
                        {/* 刷新实例 */}
                        <Tooltip content="同步实例">
                          <Button isIconOnly size="sm" variant="light" color="secondary" onPress={()=>handleRefreshTunnels(ep.id)}>
                            <FontAwesomeIcon icon={faSync} />
                          </Button>
                        </Tooltip>
                        {/* 修改密钥 */}
                        <Tooltip content="修改密钥">
                          <Button isIconOnly size="sm" variant="light" color="warning" onPress={()=>handleEditApiKeyClick(ep)}>
                            <FontAwesomeIcon icon={faKey} />
                          </Button>
                        </Tooltip>
                        {/* 复制配置 */}
                        <Tooltip content="复制配置">
                          <Button isIconOnly size="sm" variant="light" color="success" onPress={()=>handleCopyConfig(ep)}>
                            <FontAwesomeIcon icon={faCopy} />
                          </Button>
                        </Tooltip>
                        {/* 连接 / 断开 */}
                        <Tooltip content={realTimeData.status==='ONLINE' ? '断开连接' : '连接主控'}>
                          <Button isIconOnly size="sm" variant="light" color={realTimeData.status==='ONLINE' ? 'warning' : 'success'} onPress={()=>{
                            if(realTimeData.status==='ONLINE') handleDisconnect(ep.id); else handleConnect(ep.id);
                          }}>
                            <FontAwesomeIcon icon={realTimeData.status==='ONLINE'?faPlugCircleXmark:faPlug} />
                          </Button>
                        </Tooltip>
                        {/* 删除 */}
                        <Tooltip content="删除主控">
                          <Button isIconOnly size="sm" variant="light" color="danger" onPress={()=>handleDeleteClick(ep)}>
                            <FontAwesomeIcon icon={faTrash} />
                          </Button>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* 添加主控行 */}
              <TableRow key="add-row">
                <TableCell colSpan={6}>
                  <Button
                    variant="light"
                    className="w-full border-2 border-dashed border-default-300 hover:border-primary"
                    onPress={onAddOpen}
                  >
                    <FontAwesomeIcon icon={faPlus} className="mr-2" />
                    添加 API 主控
                  </Button>
                </TableCell>
              </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      )}
      {/* 添加主控模态框 */}
      <AddEndpointModal
        isOpen={isAddOpen}
        onOpenChange={onAddOpenChange}
        onAdd={handleAddEndpoint}
      />

      {/* 重命名模态框 */}
      {selectedEndpoint && (
        <RenameEndpointModal
          isOpen={isRenameOpen}
          onOpenChange={onRenameOpenChange}
          currentName={selectedEndpoint.name}
          onRename={handleRename}
        />
      )}

      {/* 修改密钥模态框 */}
      {selectedEndpoint && (
        <EditApiKeyModal
          isOpen={isEditApiKeyOpen}
          onOpenChange={onEditApiKeyOpenChange}
          currentApiKey={selectedEndpoint.apiKey}
          endpointName={selectedEndpoint.name}
          onSave={handleEditApiKey}
        />
      )}

      {/* 添加隧道弹窗 */}
      <Modal isOpen={isAddTunnelOpen} onOpenChange={onAddTunnelOpenChange} placement="center">
        <ModalContent>
          {(onClose)=> (
            <>
              <ModalHeader>添加实例</ModalHeader>
              <ModalBody>
                <div className="space-y-3">
                  <Input
                    placeholder="实例名称"
                    value={tunnelName}
                    onValueChange={setTunnelName}
                  />
                  <Input
                    placeholder="<core>://<tunnel_addr>/<target_addr>"
                    value={tunnelUrl}
                    onValueChange={setTunnelUrl}
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>取消</Button>
                <Button color="primary" onPress={handleSubmitAddTunnel}>确定</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* 删除确认模态框 */}
      <Modal isOpen={isDeleteOpen} onOpenChange={onDeleteOpenChange} placement="center">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faTrash} className="text-danger" />
                  确认删除主控
                </div>
              </ModalHeader>
              <ModalBody>
                {deleteModalEndpoint && (
                  <>
                    <p className="text-default-600">
                      您确定要删除主控 <span className="font-semibold text-foreground">"{deleteModalEndpoint.name}"</span> 吗？
                    </p>
                    <p className="text-small text-warning">
                      ⚠️ 此操作不可撤销，主控的所有配置都将被永久删除。
                    </p>
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
                    handleDeleteEndpoint();
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

      {/* 手动复制模态框 */}
      <ManualCopyModal
        isOpen={isManualCopyOpen}
        onOpenChange={onManualCopyOpenChange}
        text={manualCopyText}
      />

      {/* 导入数据模态框 */}
      <Modal 
        isOpen={isImportOpen} 
        onOpenChange={onImportOpenChange}
        placement="center"
        backdrop="blur"
        classNames={{
          backdrop: "bg-gradient-to-t from-zinc-900 to-zinc-900/10 backdrop-opacity-20"
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:import-bold" className="text-primary" width={24} />
                  导入数据
                </div>
              </ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Button
                      color="primary"
                      variant="light"
                      startContent={<Icon icon="solar:folder-with-files-linear" width={18} />}
                      onPress={() => fileInputRef.current?.click()}
                      isDisabled={isSubmitting}
                    >
                      选择文件
                    </Button>
                    <span className="text-small text-default-500">
                      {selectedFile ? selectedFile.name : '未选择文件'}
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>
                  
                  <div className="text-small text-default-500">
                    <p>• 请选择之前导出的 JSON 格式数据文件</p>
                    <p>• 导入过程中请勿关闭窗口</p>
                    <p>• 重复的数据将被自动跳过</p>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button 
                  color="danger" 
                  variant="light" 
                  onPress={onClose}
                  isDisabled={isSubmitting}
                >
                  取消
                </Button>
                <Button 
                  color="primary" 
                  onPress={handleImportData}
                  isLoading={isSubmitting}
                  startContent={!isSubmitting ? <Icon icon="solar:check-circle-linear" width={18} /> : null}
                >
                  {isSubmitting ? "导入中..." : "开始导入"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
} 