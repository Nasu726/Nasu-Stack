import { Stack } from "@/components/ui/layout";
import {
  AbortSection,
  ButtonSection,
  GuardRaceSection,
  InteractionGuardSection,
  RetryDelayProbe,
} from "./ActionStateDemos";
import {
  AutosaveSection,
  CopySection,
  ErrorBoundarySection,
} from "./PersistenceStateDemos";
import {
  CursorHookRaceProbe,
  FormSection,
  ListSection,
  LoadMoreSection,
  SearchListSection,
} from "./CollectionStateDemos";
import { ToastDurationProbe, ToastSection } from "./ToastStateDemos";

export function StateDemo() {
  return (
    <Stack space="3xl">
      <ButtonSection />
      <InteractionGuardSection />
      <CopySection />
      <ErrorBoundarySection />
      <AutosaveSection />
      <FormSection />
      <ListSection />
      <SearchListSection />
      <LoadMoreSection />
      <AbortSection />
      <GuardRaceSection />
      <ToastSection />
      <RetryDelayProbe />
      <ToastDurationProbe />
      <CursorHookRaceProbe />
    </Stack>
  );
}
