import { TextTransactionScreen, type TextTransactionDraft } from './TextTransactionScreen';

type Props = {
  selectedControlName: string;
  onBack: () => void;
  onReview: (draft: TextTransactionDraft) => void;
  backLabel?: string;
};

export function VoiceTransactionScreen(props: Props) {
  return <TextTransactionScreen {...props} mode="voice" />;
}

export default VoiceTransactionScreen;
