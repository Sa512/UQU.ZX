export const pushSupported = false;
export const getPushToken = async (): Promise<string | null> => null;
export const onAnnouncementTap = (_cb: (code: string) => void): (() => void) => () => {};
