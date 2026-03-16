/**
 * Tests for Haptic Feedback Service
 */

// Unmock the haptics module so we can test the real implementation
import * as ExpoHaptics from 'expo-haptics';

// Import haptics after mocks are set up
import { haptics } from '../haptics';

jest.unmock('@/core/native/haptics');

// Mock haptic settings store BEFORE importing haptics
const mockSettings = {
  enabled: true,
  playbackControls: true,
  scrubberFeedback: true,
  speedControl: true,
  sleepTimer: true,
  downloads: true,
  bookmarks: true,
  completions: true,
  uiInteractions: true,
};

jest.mock('@/features/profile/stores/hapticSettingsStore', () => ({
  useHapticSettingsStore: {
    getState: jest.fn(() => mockSettings),
  },
}));

describe('HapticService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset settings to enabled
    Object.assign(mockSettings, {
      enabled: true,
      playbackControls: true,
      scrubberFeedback: true,
      speedControl: true,
      sleepTimer: true,
      downloads: true,
      bookmarks: true,
      completions: true,
      uiInteractions: true,
    });
  });

  describe('core feedback methods', () => {
    it('triggers impact feedback', () => {
      haptics.impact('medium');

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('medium');
    });

    it('triggers light impact', () => {
      haptics.impact('light');

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('light');
    });

    it('triggers heavy impact', () => {
      haptics.impact('heavy');

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('heavy');
    });

    it('triggers soft impact', () => {
      haptics.impact('soft');

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('soft');
    });

    it('triggers selection feedback', () => {
      haptics.selection();

      expect(ExpoHaptics.selectionAsync).toHaveBeenCalled();
    });

    it('triggers notification feedback', () => {
      haptics.notification('success');

      expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith('success');
    });

    it('triggers warning notification', () => {
      haptics.notification('warning');

      expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith('warning');
    });

    it('triggers error notification', () => {
      haptics.notification('error');

      expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith('error');
    });
  });

  describe('when haptics are disabled', () => {
    beforeEach(() => {
      mockSettings.enabled = false;
    });

    it('does not trigger impact when disabled', () => {
      haptics.impact('medium');

      expect(ExpoHaptics.impactAsync).not.toHaveBeenCalled();
    });

    it('does not trigger selection when disabled', () => {
      haptics.selection();

      expect(ExpoHaptics.selectionAsync).not.toHaveBeenCalled();
    });

    it('does not trigger notification when disabled', () => {
      haptics.notification('success');

      expect(ExpoHaptics.notificationAsync).not.toHaveBeenCalled();
    });

    it('does not trigger button press when disabled', () => {
      haptics.buttonPress();

      expect(ExpoHaptics.impactAsync).not.toHaveBeenCalled();
    });
  });

  describe('playback control haptics', () => {
    it('triggers playbackToggle', () => {
      haptics.playbackToggle();

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('medium');
    });

    it('triggers skip', () => {
      haptics.skip();

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('light');
    });

    it('triggers chapterChange', () => {
      haptics.chapterChange();

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('soft');
    });

    it('respects playbackControls category setting', () => {
      mockSettings.playbackControls = false;

      haptics.playbackToggle();

      expect(ExpoHaptics.impactAsync).not.toHaveBeenCalled();
    });
  });

  describe('scrubber haptics', () => {
    it('triggers seek', () => {
      haptics.seek();

      expect(ExpoHaptics.selectionAsync).toHaveBeenCalled();
    });

    it('triggers chapterMarker', () => {
      haptics.chapterMarker();

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('light');
    });

    it('triggers chapterSnap', () => {
      haptics.chapterSnap();

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('medium');
    });

    it('respects scrubberFeedback category setting', () => {
      mockSettings.scrubberFeedback = false;

      haptics.seek();
      haptics.chapterMarker();

      expect(ExpoHaptics.selectionAsync).not.toHaveBeenCalled();
      expect(ExpoHaptics.impactAsync).not.toHaveBeenCalled();
    });
  });

  describe('speed control haptics', () => {
    it('triggers speedChange', () => {
      haptics.speedChange();

      expect(ExpoHaptics.selectionAsync).toHaveBeenCalled();
    });

    it('triggers speedBoundary with double feedback', async () => {
      jest.useFakeTimers();

      haptics.speedBoundary();

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('medium');

      jest.advanceTimersByTime(50);

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('light');

      jest.useRealTimers();
    });

    it('triggers speedDefault', () => {
      haptics.speedDefault();

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('light');
    });

    it('respects speedControl category setting', () => {
      mockSettings.speedControl = false;

      haptics.speedChange();

      expect(ExpoHaptics.selectionAsync).not.toHaveBeenCalled();
    });
  });

  describe('sleep timer haptics', () => {
    it('triggers sleepTimerSet', () => {
      haptics.sleepTimerSet();

      expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith('success');
    });

    it('triggers sleepTimerClear', () => {
      haptics.sleepTimerClear();

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('light');
    });

    it('triggers sleepTimerWarning', () => {
      haptics.sleepTimerWarning();

      expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith('warning');
    });

    it('respects sleepTimer category setting', () => {
      mockSettings.sleepTimer = false;

      haptics.sleepTimerSet();

      expect(ExpoHaptics.notificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('download haptics', () => {
    it('triggers downloadStart', () => {
      haptics.downloadStart();

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('light');
    });

    it('triggers downloadComplete', () => {
      haptics.downloadComplete();

      expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith('success');
    });

    it('triggers downloadFailed', () => {
      haptics.downloadFailed();

      expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith('error');
    });

    it('respects downloads category setting', () => {
      mockSettings.downloads = false;

      haptics.downloadComplete();

      expect(ExpoHaptics.notificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('bookmark haptics', () => {
    it('triggers bookmarkCreated', () => {
      haptics.bookmarkCreated();

      expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith('success');
    });

    it('triggers bookmarkDeleted', () => {
      haptics.bookmarkDeleted();

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('light');
    });

    it('triggers bookmarkJump', () => {
      haptics.bookmarkJump();

      expect(ExpoHaptics.selectionAsync).toHaveBeenCalled();
    });

    it('respects bookmarks category setting', () => {
      mockSettings.bookmarks = false;

      haptics.bookmarkCreated();

      expect(ExpoHaptics.notificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('completion haptics', () => {
    it('triggers bookComplete with pattern', async () => {
      jest.useFakeTimers();

      haptics.bookComplete();

      expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith('success');

      jest.advanceTimersByTime(100);

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('light');

      jest.useRealTimers();
    });

    it('triggers seriesComplete with longer pattern', async () => {
      jest.useFakeTimers();

      haptics.seriesComplete();

      expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith('success');

      jest.advanceTimersByTime(150);

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('medium');

      jest.advanceTimersByTime(100);

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('light');

      jest.useRealTimers();
    });

    it('triggers progressMilestone', () => {
      haptics.progressMilestone();

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('light');
    });

    it('respects completions category setting', () => {
      mockSettings.completions = false;

      haptics.bookComplete();

      expect(ExpoHaptics.notificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('UI interaction haptics', () => {
    it('triggers buttonPress', () => {
      haptics.buttonPress();

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('light');
    });

    it('triggers toggle', () => {
      haptics.toggle();

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('medium');
    });

    it('triggers importantAction', () => {
      haptics.importantAction();

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('heavy');
    });

    it('triggers longPress', () => {
      haptics.longPress();

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('heavy');
    });

    it('triggers pullToRefresh', () => {
      haptics.pullToRefresh();

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('medium');
    });

    it('triggers swipeComplete', () => {
      haptics.swipeComplete();

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('soft');
    });

    it('triggers destructiveConfirm with double pattern', async () => {
      jest.useFakeTimers();

      haptics.destructiveConfirm();

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('heavy');

      jest.advanceTimersByTime(80);

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('medium');

      jest.useRealTimers();
    });

    it('triggers undoAvailable', () => {
      haptics.undoAvailable();

      expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('soft');
    });

    it('respects uiInteractions category setting', () => {
      mockSettings.uiInteractions = false;

      haptics.buttonPress();
      haptics.toggle();

      expect(ExpoHaptics.impactAsync).not.toHaveBeenCalled();
    });
  });

  describe('generic feedback methods', () => {
    it('triggers success', () => {
      haptics.success();

      expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith('success');
    });

    it('triggers warning', () => {
      haptics.warning();

      expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith('warning');
    });

    it('triggers error', () => {
      haptics.error();

      expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith('error');
    });
  });

  describe('isEnabled and isCategoryEnabled', () => {
    it('returns true when enabled', () => {
      expect(haptics.isEnabled()).toBe(true);
    });

    it('returns false when disabled', () => {
      mockSettings.enabled = false;
      expect(haptics.isEnabled()).toBe(false);
    });

    it('checks category enabled correctly', () => {
      expect(haptics.isCategoryEnabled('playbackControls')).toBe(true);

      mockSettings.playbackControls = false;
      expect(haptics.isCategoryEnabled('playbackControls')).toBe(false);
    });

    it('returns false for category when globally disabled', () => {
      mockSettings.enabled = false;
      mockSettings.playbackControls = true;

      expect(haptics.isCategoryEnabled('playbackControls')).toBe(false);
    });
  });
});
