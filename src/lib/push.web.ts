export const pushSupported = false;
export const getPushToken = async (): Promise<string | null> => null;
export const onAnnouncementTap = (_cb: (code: string) => void, _onBooking?: () => void, _onCancelled?: () => void): (() => void) => () => {};
export const onPushReceived = (_type: string, _cb: () => void): (() => void) => () => {};
