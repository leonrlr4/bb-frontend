import React, { useState, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { WorkflowPanel } from './components/WorkflowPanel';
import { MainPanel } from './components/MainPanel';
import { AuthModal } from './components/AuthModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkflowProvider, useWorkflow } from './context/WorkflowContext';

const AppLayout: React.FC = () => {
  const [sidebarWidth, setSidebarWidth] = useState(22); // Percentage
  const appContainerRef = useRef<HTMLDivElement>(null);
  const { user, isAuthModalOpen, closeAuthModal, openAuthModal, handleLoginSuccess, handleSignOut } = useAuth();
  const {
    workflows,
    activeWorkflow,
    isHistoryLoading,
    isDetailsLoading,
    error,
    selectWorkflow,
    createNewWorkflow,
    sendMessage,
    fetchHistory,
    isStreaming,
    liveStreamingState,
    streamingMessageId,
    initialPrompt,
    setInitialPrompt,
  } = useWorkflow();

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const containerNode = appContainerRef.current;
    if (!containerNode) return;

    const handleMouseMove = (event: MouseEvent) => {
      const containerRect = containerNode.getBoundingClientRect();
      if (containerRect.width === 0) return;

      const newWidth = event.clientX - containerRect.left;
      let newWidthPercent = (newWidth / containerRect.width) * 100;

      const minPercent = 15;
      const maxPercent = 40;
      if (newWidthPercent < minPercent) newWidthPercent = minPercent;
      if (newWidthPercent > maxPercent) newWidthPercent = maxPercent;

      setSidebarWidth(newWidthPercent);
    };

    const handleMouseUp = () => {
      document.body.style.cursor = 'default';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  return (
    <div className="flex flex-col h-screen font-sans text-slate-200 overflow-hidden">
      <Header user={user} onSignInClick={openAuthModal} onSignOutClick={handleSignOut} />
      <div ref={appContainerRef} className="flex flex-1 p-2 sm:p-4 pt-0 gap-2 overflow-hidden">
        <div style={{ width: `${sidebarWidth}%` }} className="min-w-[15rem] max-w-[40%] flex h-full">
          <WorkflowPanel
            workflows={workflows}
            activeWorkflowId={activeWorkflow?.id || null}
            onSelectWorkflow={selectWorkflow}
            onNewWorkflow={createNewWorkflow}
            onRefresh={fetchHistory}
            isRefreshing={isHistoryLoading}
            setInitialPrompt={setInitialPrompt}
          />
        </div>

        <div onMouseDown={handleResizeMouseDown} className="w-2 cursor-col-resize flex items-center justify-center group flex-shrink-0"
          aria-label="Resize sidebar" role="separator" aria-orientation="vertical">
          <div className="w-0.5 h-full bg-slate-700/50 group-hover:bg-cyan-500/80 transition-colors duration-200 rounded-full"></div>
        </div>

        <div className="flex-1 min-w-0 flex h-full">
          <MainPanel
            workflow={activeWorkflow}
            onSendMessage={sendMessage}
            isLoading={isDetailsLoading}
            error={error}
            initialPrompt={initialPrompt}
            onInitialPromptConsumed={() => setInitialPrompt('')}
            isStreaming={isStreaming}
            liveStreamingState={liveStreamingState}
            streamingMessageId={streamingMessageId}
          />
        </div>
      </div>
      <AuthModal isOpen={isAuthModalOpen} onClose={closeAuthModal} onSuccess={handleLoginSuccess} />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <WorkflowProvider>
        <AppLayout />
      </WorkflowProvider>
    </AuthProvider>
  );
};

export default App;