"use client";

import { useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import ChatArea from "@/components/ChatArea";
import ChatHeader from "@/components/ChatHeader";
import SubagentPanel from "@/components/SubagentPanel";
import SettingsPanel from "@/components/SettingsPanel";
import APIKeysPanel from "@/components/APIKeysPanel";
import { Conversation, DelegationStep, cancelTask } from "@/lib/api";

export default function Home() {
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [conversationTitle, setConversationTitle] = useState("");
  const [steps, setSteps] = useState<DelegationStep[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showStepPanel, setShowStepPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAPIKeys, setShowAPIKeys] = useState(false);

  const handleSelectConversation = useCallback((id: string) => {
    if (!id) {
      setActiveConversation(null);
      setConversationTitle("");
      setSteps([]);
      setShowStepPanel(false);
      return;
    }
    setActiveConversation({ id, title: "", created_at: "", updated_at: "" } as Conversation);
    setConversationTitle("");
    setSteps([]);
    setShowStepPanel(false);
  }, []);

  const handleNewChat = useCallback((convo: Conversation) => {
    setActiveConversation(convo);
    setConversationTitle(convo.title || "New Chat");
    setSteps([]);
    setShowStepPanel(false);
  }, []);

  const handleTitleUpdate = useCallback((title: string) => {
    setConversationTitle(title);
  }, []);

  const handleStepsUpdate = useCallback((newSteps: DelegationStep[]) => {
    setSteps(newSteps);
  }, []);

  const handleLoadingChange = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

  async function handleStop() {
    if (activeConversation) {
      await cancelTask(activeConversation.id);
    }
    setIsLoading(false);
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      {/* Sidebar */}
      <Sidebar
        activeConversationId={activeConversation?.id || null}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onOpenSettings={() => setShowSettings(true)}
        onOpenAPIKeys={() => setShowAPIKeys(true)}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Chat Header */}
        <ChatHeader
          conversationId={activeConversation?.id || null}
          conversationTitle={conversationTitle || activeConversation?.title || ""}
          stepsCount={steps.length}
          isLoading={isLoading}
          onToggleSteps={() => setShowStepPanel(!showStepPanel)}
          onStop={handleStop}
        />

        {/* Chat Area */}
        <ChatArea
          conversationId={activeConversation?.id || null}
          onTitleUpdate={handleTitleUpdate}
          onStepsUpdate={handleStepsUpdate}
          onLoadingChange={handleLoadingChange}
        />
      </main>

      {/* Subagent slide-in panel */}
      {showStepPanel && (
        <SubagentPanel
          steps={steps}
          onClose={() => setShowStepPanel(false)}
        />
      )}

      {/* Settings modal */}
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* API Keys modal */}
      <APIKeysPanel isOpen={showAPIKeys} onClose={() => setShowAPIKeys(false)} />
    </div>
  );
}
