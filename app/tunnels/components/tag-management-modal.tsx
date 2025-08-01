"use client";

import React, { useState, useEffect } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Chip,
  useDisclosure,
  Spinner,
  Tooltip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem
} from "@heroui/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faPlus, 
  faTrash, 
  faPen, 
  faTag,
  faEllipsisV,
  faGripVertical
} from "@fortawesome/free-solid-svg-icons";
import { addToast } from "@heroui/toast";
import { buildApiUrl } from '@/lib/utils';

// 标签类型
interface Tag {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

interface TagManagementModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export default function TagManagementModal({ 
  isOpen, 
  onOpenChange, 
  onSaved 
}: TagManagementModalProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // 编辑状态
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editName, setEditName] = useState("");
  
  // 新增状态
  const [newTagName, setNewTagName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // 获取标签列表
  const fetchTags = async () => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  // 创建标签
  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      addToast({
        title: '错误',
        description: '请输入标签名称',
        color: 'danger'
      });
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(buildApiUrl('/api/tags'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTagName.trim()
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '创建标签失败');
      }

      addToast({
        title: '成功',
        description: '标签创建成功',
        color: 'success'
      });

      setNewTagName("");
      setShowAddForm(false);
      fetchTags();
      onSaved(); // 通知父组件刷新标签列表
    } catch (error) {
      console.error('创建标签失败:', error);
      addToast({
        title: '错误',
        description: error instanceof Error ? error.message : '创建标签失败',
        color: 'danger'
      });
    } finally {
      setSaving(false);
    }
  };

  // 开始编辑
  const handleEdit = (tag: Tag) => {
    setEditingTag(tag);
    setEditName(tag.name);
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingTag || !editName.trim()) {
      addToast({
        title: '错误',
        description: '请输入标签名称',
        color: 'danger'
      });
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(buildApiUrl(`/api/tags/${editingTag.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim()
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '更新标签失败');
      }

      addToast({
        title: '成功',
        description: '标签更新成功',
        color: 'success'
      });

      setEditingTag(null);
      setEditName("");
      fetchTags();
      onSaved(); // 通知父组件刷新标签列表
    } catch (error) {
      console.error('更新标签失败:', error);
      addToast({
        title: '错误',
        description: error instanceof Error ? error.message : '更新标签失败',
        color: 'danger'
      });
    } finally {
      setSaving(false);
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingTag(null);
    setEditName("");
  };

  // 删除标签
  const handleDelete = async (tag: Tag) => {
    if (!confirm(`确定要删除标签 "${tag.name}" 吗？`)) {
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(buildApiUrl(`/api/tags/${tag.id}`), {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '删除标签失败');
      }

      addToast({
        title: '成功',
        description: '标签删除成功',
        color: 'success'
      });

      fetchTags();
      onSaved(); // 通知父组件刷新标签列表
    } catch (error) {
      console.error('删除标签失败:', error);
      addToast({
        title: '错误',
        description: error instanceof Error ? error.message : '删除标签失败',
        color: 'danger'
      });
    } finally {
      setSaving(false);
    }
  };

  // 模态框关闭时重置状态
  const handleClose = () => {
    setEditingTag(null);
    setEditName("");
    setNewTagName("");
    setShowAddForm(false);
    onOpenChange(false);
  };

  // 模态框打开时获取数据
  useEffect(() => {
    if (isOpen) {
      fetchTags();
    }
  }, [isOpen]);

  return (
    <Drawer 
      isOpen={isOpen} 
      onOpenChange={handleClose}
      size="lg"
      placement="right"
      hideCloseButton={true}
    >
      <DrawerContent>
        <>
          <DrawerHeader className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faTag} className="text-primary" />
                标签管理
              </div>
              <Button
                size="sm"
                color="primary"
                variant="flat"
                startContent={<FontAwesomeIcon icon={faPlus} />}
                onClick={() => setShowAddForm(true)}
              >
                添加
              </Button>
            </div>
          </DrawerHeader>
          <DrawerBody>
              {/* 添加新标签区域 */}
              {showAddForm && (
                <div className="mb-6 p-4 border border-default-200 rounded-lg bg-default-50">
                  <div className="flex items-center gap-4 mb-4">
                    <Input
                      label="标签名称"
                      placeholder="请输入标签名称"
                      value={newTagName}
                      onValueChange={setNewTagName}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      color="primary"
                      onClick={handleCreateTag}
                      isLoading={saving}
                      isDisabled={!newTagName.trim()}
                    >
                      保存
                    </Button>
                    <Button
                      color="default"
                      variant="light"
                      onClick={() => {
                        setShowAddForm(false);
                        setNewTagName("");
                      }}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              )}

              {/* 标签列表 */}
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <Spinner size="lg" />
                </div>
              ) : (
                <Table aria-label="标签列表">
                  <TableHeader>
                    <TableColumn>标签名称</TableColumn>
                    <TableColumn>操作</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {tags.map((tag) => (
                      <TableRow key={tag.id}>
                        <TableCell>
                          {editingTag?.id === tag.id ? (
                            <div className="flex items-center gap-4">
                              <Input
                                value={editName}
                                onValueChange={setEditName}
                                size="sm"
                                className="flex-1"
                              />
                            </div>
                          ) : (
                            <span className="text-sm">{tag.name}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingTag?.id === tag.id ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                color="primary"
                                onClick={handleSaveEdit}
                                isLoading={saving}
                              >
                                保存
                              </Button>
                              <Button
                                size="sm"
                                color="default"
                                variant="light"
                                onClick={handleCancelEdit}
                              >
                                取消
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Tooltip content="编辑标签" size="sm">
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  color="primary"
                                  onClick={() => handleEdit(tag)}
                                >
                                  <FontAwesomeIcon icon={faPen} className="text-xs" />
                                </Button>
                              </Tooltip>
                              <Tooltip content="删除标签" size="sm">
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  color="danger"
                                  onClick={() => handleDelete(tag)}
                                >
                                  <FontAwesomeIcon icon={faTrash} className="text-xs" />
                                </Button>
                              </Tooltip>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {!loading && tags.length === 0 && (
                <div className="text-center py-8">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-default-100 flex items-center justify-center">
                      <FontAwesomeIcon icon={faTag} className="text-2xl text-default-400" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-default-500 text-sm font-medium">暂无标签</p>
                      <p className="text-default-400 text-xs">点击上方按钮创建第一个标签</p>
                    </div>
                  </div>
                </div>
              )}
            </DrawerBody>
            <DrawerFooter>
              <Button color="default" variant="light" onPress={handleClose}>
                关闭
              </Button>
            </DrawerFooter>
          </>
        </DrawerContent>
      </Drawer>
  );
} 