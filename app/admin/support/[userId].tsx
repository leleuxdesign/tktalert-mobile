import { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TextInput, StyleSheet, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { trpc } from "@/lib/trpc";
import { colors, fontFamily } from "@/lib/ios6-theme";
import { IosPage, IosNavBar, IosButton } from "@/components/ios6";

/**
 * Admin side of one conversation — the same thread the customer sees.
 *
 * Sending from here also pushes to their phone, so a reply reaches someone who
 * is not currently in the app, which is most people most of the time.
 */
export default function AdminSupportThread() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const id = Number(userId);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const utils = trpc.useUtils();

  const { data } = trpc.adminSupport.thread.useQuery(
    { userId: id },
    { enabled: Number.isFinite(id), refetchInterval: 20_000 }
  );
  const markRead = trpc.adminSupport.markRead.useMutation({
    onSuccess: () => utils.adminSupport.inbox.invalidate(),
  });
  const reply = trpc.adminSupport.reply.useMutation({
    onSuccess: async () => {
      setDraft("");
      await utils.adminSupport.thread.invalidate();
      await utils.adminSupport.inbox.invalidate();
    },
  });

  // Opening the thread is what "reading" means.
  useEffect(() => {
    if (Number.isFinite(id)) markRead.mutate({ userId: id });
  }, [id]);

  const messages: any[] = (data as any)?.messages ?? [];

  return (
    <IosPage>
      <IosNavBar title="Conversation" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <Text style={styles.empty}>
              No messages yet. Anything you send starts the conversation and pushes to
              their phone.
            </Text>
          ) : messages.map((m) => (
            <View
              key={m.id}
              style={[styles.bubble, m.senderRole === "admin" ? styles.mine : styles.theirs]}
            >
              <Text style={m.senderRole === "admin" ? styles.mineText : styles.theirsText}>
                {m.body}
              </Text>
              <Text style={[styles.stamp, m.senderRole === "admin" && { color: "rgba(255,255,255,0.75)" }]}>
                {new Date(m.createdAt).toLocaleString()}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Write a reply…"
            placeholderTextColor={colors.textLight}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <IosButton
            variant="blue"
            loading={reply.isPending}
            onPress={() => reply.mutate({ userId: id, body: draft.trim() })}
          >
            Send Reply
          </IosButton>
        </View>
      </KeyboardAvoidingView>
    </IosPage>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 13, color: colors.textLight, fontFamily, textAlign: "center", paddingVertical: 24, lineHeight: 19 },
  bubble: { maxWidth: "82%", paddingHorizontal: 13, paddingVertical: 9, borderRadius: 16 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.blue },
  theirs: { alignSelf: "flex-start", backgroundColor: "rgba(0,0,0,0.06)" },
  mineText: { color: "#fff", fontSize: 15, fontFamily, lineHeight: 20 },
  theirsText: { color: colors.text, fontSize: 15, fontFamily, lineHeight: 20 },
  stamp: { fontSize: 10, color: colors.textLight, fontFamily, marginTop: 4 },
  composer: {
    padding: 12, gap: 10, borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.12)", backgroundColor: colors.background,
  },
  input: {
    minHeight: 44, maxHeight: 120, borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.18)", borderRadius: 10, backgroundColor: "#fff",
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    color: colors.text, fontFamily,
  },
});
