"use client";

import { Component, ReactNode, ErrorInfo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('错误边界捕获到错误:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center"
        >
          <motion.div
            animate={{ 
              rotate: [0, 10, -10, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="mb-6 text-red-500"
          >
            <AlertTriangle size={64} />
          </motion.div>
          
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            哎呀，出了点问题
          </h2>
          
          <p className="text-gray-600 mb-6 max-w-md">
            应用遇到了意外错误。请尝试刷新页面，或者联系技术支持。
          </p>
          
          {this.state.error && (
            <details className="mb-6 p-4 bg-gray-100 rounded-lg text-left max-w-lg">
              <summary className="cursor-pointer font-medium text-gray-700">
                错误详情
              </summary>
              <pre className="mt-2 text-xs text-gray-600 overflow-auto">
                {this.state.error.message}
              </pre>
            </details>
          )}
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={this.handleReset}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors"
          >
            <RotateCcw size={16} />
            重新尝试
          </motion.button>
        </motion.div>
      );
    }

    return this.props.children;
  }
}