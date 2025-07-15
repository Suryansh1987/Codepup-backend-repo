import { useState, useEffect } from 'react';
import axios from 'axios';
import type { Todo } from '@/types';

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch todos
  const fetchTodos = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/todos');
      if (response.data.success) {
        setTodos(response.data.data || []);
      }
    } catch (err) {
      setError('Failed to fetch todos');
      console.error('Error fetching todos:', err);
    } finally {
      setLoading(false);
    }
  };

  // Add todo
  const addTodo = async (todoData: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const response = await axios.post('/api/todos', todoData);
      if (response.data.success) {
        setTodos(prev => [response.data.data, ...prev]);
      }
    } catch (err) {
      setError('Failed to add todo');
      console.error('Error adding todo:', err);
    }
  };

  // Update todo
  const updateTodo = async (id: string, updates: Partial<Todo>) => {
    try {
      const response = await axios.put(`/api/todos/${id}`, updates);
      if (response.data.success) {
        setTodos(prev => prev.map(todo => 
          todo.id === id ? { ...todo, ...response.data.data } : todo
        ));
      }
    } catch (err) {
      setError('Failed to update todo');
      console.error('Error updating todo:', err);
    }
  };

  // Delete todo
  const deleteTodo = async (id: string) => {
    try {
      const response = await axios.delete(`/api/todos/${id}`);
      if (response.data.success) {
        setTodos(prev => prev.filter(todo => todo.id !== id));
      }
    } catch (err) {
      setError('Failed to delete todo');
      console.error('Error deleting todo:', err);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, []);

  return {
    todos,
    loading,
    error,
    addTodo,
    updateTodo,
    deleteTodo,
    refetch: fetchTodos
  };
}