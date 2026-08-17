import { createFileRoute } from "@tanstack/react-router";

import { ChatFab } from "@/components/smartml/ChatFab";
import { SmartMLWorkflow } from "@/components/smartml/SmartMLWorkflow";
import { useSmartML } from "@/hooks/useSmartML";

export const Route = createFileRoute("/")({
  component: SmartMLApp,
});

function SmartMLApp() {
  const smartml = useSmartML();

  return (
    <>
      <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-12">
        <main className="min-w-0 lg:col-span-12">
          <SmartMLWorkflow {...smartml} />
        </main>
      </div>
      <ChatFab
        messages={smartml.chat}
        mode={smartml.mode}
        onSend={smartml.pushUser}
        onAssistantReply={smartml.pushAssistant}
        onAsk={smartml.sendChatMessage}
      />
    </>
  );
}