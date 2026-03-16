/**
 * Login screen with updated design system
 * Enhanced with real-time URL validation feedback per UX research
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, X, AlertCircle, Eye, EyeOff } from 'lucide-react-native';
import { SvgXml } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/core/auth';
// Button import removed — using custom white-outline TouchableOpacity
import { SkullCandle } from '@/shared/components/AnimatedSplash';
import { spacing, radius, scale, useTheme } from '@/shared/theme';
import { logger } from '@/shared/utils/logger';

const SAVED_USERNAME_KEY = 'login_saved_username';
const SAVED_SERVER_URL_KEY = 'login_saved_server_url';

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 786.7 149.9"><g><path fill="currentColor" d="M178.9,112c-1.5,1.5-3.4,2.3-5.3,3-2.3.9-4.5,1.8-6.8,2.4-2.7.7-5.4,1.4-8.2,1.7-2.6.3-5.2.2-7.8.2-2.7,0-5.3,1.2-8,1.3-2.3,0-4.6,0-6.9.1-2,0-4.1,0-4.8-2.7-.2-.7-.2-1.7,0-2.5,0,0,0,0,0,0-.5-12.2.9-8.6,3.6-6.6,1.5,1.2,3.7.4,5.5.4,2.1,0,4.1,0,6.2-.2,7.5-.4,15.3-1.8,22.9-1.2,1.9-.9,3.9-2.4,4.9-4.4.4-2.4-.3-4.6-.8-7.3-.1-.7-.2-1.4-.3-2.1-.2-.6-.4-1.3-.5-2,0-.2,0-.4-.1-.6-2.4-2.4-6.1-3.5-9.4-4.2-2.5-.3-4.9-.5-7.4-.6-2.2,0-4.4-.3-6.6-.2-2.2,0-4.4.3-6.6,0-2.5-.3-5.1,0-7.5-.4-.1,0-.3,0-.4,0-1.6-.2-3.1-1.2-4.1-2.7-2.2-2.6-3.3-6.4-3.6-10-.1-1.6,0-3.1.3-4.6,0-1,0-2,.2-3,0-3.4.9-7.4,2.7-10.1.3-.7.7-1.4,1.1-2,2.4-4,6.2-5.5,10.2-6.3,4.6-1,9.4-1.3,14.1-1.4,4.7-.2,9.5-.5,14.1.8,3.1.9,7.3-2.9,7.6,1.4,0,.4-.6,6.4-.7,6.8,0,.9,0,1.8-.4,2.6-.8,2-2.5,2.4-4.3,2.4-1.3.4-2.7.6-3.9.7-4.2.3-8.4.8-12.6,1-1.7,0-6,.7-9.1,0-.3,0-.7.2-1,.3-2.8.8-6.2,1-8.4,3.5-.8.9-1.3,2.1-1.7,3.5,0,2.1,0,4.6.9,6.2.5.8,1.1,1.4,1.6,2.1,3.9.6,7.9.8,11.8.7,5.4-.2,10.6-1.3,16-.5,3.9.6,8.5-.8,11.2,3.2.6.9,1.1,1.8,1.5,2.8.5.4,1,.9,1.3,1.5,1.1,1.8,1.8,4.5,2.1,6.7.4,2.4,1.1,4.8,1.4,7.2.6,4.7-.6,9.9-3.8,13.1Z"/><path fill="currentColor" d="M227.9,88.8c0,1.4,1.1.6,0,1.1,0,0-.6,2.5-.7,2.5-1.5,1.3-3.5,1-5.4,1.2-2.6.3-5.2,0-7.7.3-2.6.4-5.1.5-7.7.7-1.3,0-2.6.2-3.9.2.3,1.9.6,3.6.6,5.6,0,2.2-.2,4.4-.2,6.6,0,1.6.5,3.1.9,4.6.3,0,.7,0,1.1.1,1.5,0,3-.1,4.5,0,2.8,0,5.6.2,8.4.3,2.4.1,9.4,1,9.4,1,0,0,.3,3.3-.1,4.9,0,1.2-.9,2.6-2.5,2.9-2.1.3-4,0-6.1,0-1.8,0-3.6,0-5.4-.1-2.6,0-5.2,0-7.8-.3-1.2,0-2.4.2-3.6.4-1.8.3-.8.4-2.6,0-1.9-.5-2.7-2.4-2.3-4-.1-1.8,0-3.7-.4-5.5-.4-2.2-.5-4.4-.7-6.6-.5-5.1.1-10.3-.2-15.4-.2-3.8-1.1-7.6-1.3-11.3,0-1.8-.3-3.6-.4-5.4,0-1.5-.6-3.1-.5-4.6,0-3.1-1.7-5.1,1.3-4.1,2.3-.2,7.3.3,9.6.5,2.3.2,4.7,1,7,.9,3.5-.1,12.1,1.7,12.1,1.7,0,0,.2,3.4-.5,4.2,0,.2,0,.4,0,.6,0,1-.8,2-1.9,2.2-3.7.6-7.3-.6-10.9-1-1.2-.1-2.5-.4-3.7-.6-1.7,0-3.4-.3-5.1-.5.1,1.2.3,2.4.4,3.6.3,3.2.5,9.3.6,12.5,2.3-.2,4.6-.2,6.8-.3,3.1-.1,6.2-.1,9.2-.3,3.7-.1,9.9-3.4,9.8,1.3Z"/><path fill="currentColor" d="M263.8,72.3c0,0,0-.2,0-.3-.2-.8-.4-1.7-.5-2.5,0-.2,0-.3,0-.4-.5,0-1-.3-1.3-.6-.7,0-1.4,0-2.1,0-1.6.9-2.8,2.5-4.1,4.1-2.4,3.1-3.5,6.7-4.4,10.4-.4,1.6-.9,3.2-1.4,4.8,0,3.1.2,6.2-.3,9.3-.3,1.8-1,3.6-1.3,5.4-.3,2.1-.3,4.1-.2,6.2,0,.6,0,1.6,0,2.4.2.3.4.5.6.7,0,0,0,0,.1,0,1.7.3,3.4.5,5.1.5.5-.1,1.1-.3,1.7-.4,1-.1,2.1-.2,3.2-.3,1.2,0,2.3-.3,3.3-.7.3-1.1.8-2.2.9-2.6.9-2.9,1.6-7,5.9-7.3,1.7-.1,5.4,0,5.4,0,0,0-1.4,9.9-2.1,13.4-.2,1.3-.9,3.8-1.9,4.2-2.4.9-10.4,1.5-14.5,1.4-4-.1-8.2-.3-11.1-3-1-.5-1.9-1.2-2.4-2.2-.4-.7-.6-1.4-.7-2.1-1.1-2.1-1.7-4.4-1.8-6.9-.1-2.3,0-4.4.4-6.6-.2-1.1,0-2.3.2-3.5.2-2.1.4-4.1.8-6.1.7-4.1,1.4-8.4,2.7-12.4.4-1.3.9-2.5,1.4-3.8.7-2.8,1.6-5.6,3.6-7.5.9-.9,2.1-1.6,3.4-2.1.8-.8,1.8-1.5,3-2,6.6-2.3,13.8-2.8,18.4,1.8,0,0,.5,7.6,0,10.7-.5,2.7-.6,6.8-4,7.4-3.6.7-5.2-2.3-5.5-5-.2-1.5-.2-3,0-4.5Z"/><path fill="currentColor" d="M321.1,84.7c0,1.9-.2,3.8-1.3,5.5-1.2,1.8-3.2,2.9-5.5,3.4-1.1.2-2.1.3-3.2.4.2.7.4,1.4.5,2.2.7,2.7,1.1,5.5,1.9,8.2.7,2.3,1.4,4.7,1.7,7.1,0,.6.4,1.1.6,1.6.2.5.3,1.1.5,1.6.3.9,1.3,3.3,1.3,4.3,0,.9-1,.2-2,.4-.6.2-1.3.1-2,.2-.6,0-1.1.1-1.7.2-.8,0-1.7.2-2.5,0-1.1-.3-1.2-1.2-1.5-2-.5-1.1-.9-2.2-1.3-3.3-.4-1.1-.8-2.1-.9-3.3,0-1.1-.6-2.2-1.1-3.3-.5-1.1-1-2.1-1.3-3.3-.4-1.2-.8-2.3-1.3-3.4-.4-1.1-.7-2.3-1.3-3.4-.5-1-1-2-1.3-3.1,0,.1,0,.3,0,.4,0,2.2-.6,4.3-.9,6.4-.3,2.1-.6,4.2-.7,6.3,0,1-.3,2.1-.2,3.1,0,1,.4,2,.4,3.1,0,.9,0,1.8.3,2.7.1.6.2,1.2.2,1.9,0,.5-.5,1.6-.5,1.6,0,0-1.6.1-2.5,0-1.1-.2-2.4,0-3.6,0-1.2,0-2.4.2-3.6.3-.8,0-1.7.2-2.4-.3-.6-.4-.7-1.1-.7-1.7,0-.7.2-1.4.3-2,.1-.8,0-1.6.2-2.4.2-1,.5-2.1.7-3.1.2-1.1.3-2.1.2-3.2,0-2.3,0-4.5,0-6.8,0-1.1,0-2.1,0-3.2,0-1-.2-2,0-3,.1-1,.4-2.1.6-3.1.2-1.1.4-2.2.4-3.3,0-1.1.4-2.1.3-3.2,0-1.1,0-2.2,0-3.3,0-2.2-.1-4.4-.1-6.7,0-.6,0-1.2,0-1.8,0-.5.2-1,.2-1.6,0-.5,0-1.1,0-1.6,0-.4.3-.8.3-1.2,0-.1,0-.2,0-.3,0-.6.1-1.2.3-1.8,0-.3.3-.5.6-.6.7-.2,1.5-.1,2.2-.1.8,0,1.5,0,2.3-.2,1.5-.3,3.1-.5,4.6-.8,1.6-.3,3.2-.2,4.8-.2,1.7,0,3.4,0,5.1-.1.7,0,1.3-.1,2,0,.6.2,1.2.5,1.8.7,1.1.5,2.2,1.2,3.3,1.8,1.9,1,2.8,3,3.4,4.8.7,2.2,1.4,4.6,1.6,6.9.1,1.8.3,3.7.3,5.5ZM308,76.4c-.7-.4-1.5-.8-2.3-.9-1-.2-2.2,0-3.2,0-.7,0-1.5,0-2.2,0,0,1.5-.2,3-.5,4.5.8,0,1.7,0,2.4,0,1.1-.1,2.2-.4,3.3-.5.7,0,1.3-.1,2-.5.5-.3,1-.7,1-1.3,0-.5-.1-.8-.6-1.1Z"/><path fill="currentColor" d="M366.6,88.8c0,1.4,1.1.6,0,1.1,0,0-.6,2.5-.7,2.5-1.5,1.3-3.5,1-5.4,1.2-2.6.3-5.2,0-7.7.3-2.6.4-5.1.5-7.7.7-1.3,0-2.6.2-3.9.2.3,1.9.6,3.6.6,5.6,0,2.2-.2,4.4-.2,6.6,0,1.6.5,3.1.9,4.6.3,0,.7,0,1.1.1,1.5,0,3-.1,4.5,0,2.8,0,5.6.2,8.4.3,2.4.1,9.4,1,9.4,1,0,0,.3,3.3-.1,4.9,0,1.2-.9,2.6-2.5,2.9-2.1.3-4,0-6.1,0-1.8,0-3.6,0-5.4-.1-2.6,0-5.2,0-7.8-.3-1.2,0-2.4.2-3.6.4-1.8.3-.8.4-2.6,0-1.9-.5-2.7-2.4-2.3-4-.1-1.8,0-3.7-.4-5.5-.4-2.2-.5-4.4-.7-6.6-.5-5.1.1-10.3-.2-15.4-.2-3.8-1.1-7.6-1.3-11.3,0-1.8-.3-3.6-.4-5.4,0-1.5-.6-3.1-.5-4.6,0-3.1-1.7-5.1,1.3-4.1,2.3-.2,7.3.3,9.6.5,2.3.2,4.7,1,7,.9,3.5-.1,12.1,1.7,12.1,1.7,0,0,.2,3.4-.5,4.2,0,.2,0,.4,0,.6,0,1-.8,2-1.9,2.2-3.7.6-7.3-.6-10.9-1-1.2-.1-2.5-.4-3.7-.6-1.7,0-3.4-.3-5.1-.5.1,1.2.3,2.4.4,3.6.3,3.2.5,9.3.6,12.5,2.3-.2,4.6-.2,6.8-.3,3.1-.1,6.2-.1,9.2-.3,3.7-.1,9.9-3.4,9.8,1.3Z"/><path fill="currentColor" d="M404,67.7c-2.3,1-4.9,1.2-7.5,1.5,0,.7,0,1.3,0,2,0,1.9,0,3.8-.2,5.7,0,1.3.1,2.6,0,3.9,0,1.6-.3,3.3-.5,4.9.2,2.6.4,5.1.2,7.7-.5,5.2.3,10.3.4,15.5,0,2.2,0,4.4-.1,6.7,0,1.7.3,6.1.3,6.1,0,0-7,.7-7.5.5-1.1.2-2.3-.2-2.6-1.4,0,0,0-.2,0-.3,0,0,0-.1,0-.2-.3-1.5.1-3,.3-4.6.2-2,.3-4,.2-6-.2-2.2-.7-4.6-.5-6.8.2-1.9.9-3.7,1.2-5.6.4-2.6-.2-5.4,0-8,0-2.2.7-4.4.7-6.7,0-2.3-.4-4.6-.5-6.9,0-2,0-3.9,0-5.9-.2,0-.4,0-.6,0-2.2,0-4.7,1.2-7,.6-.3,0-.5-.2-.8-.3-1-.1-1.8-.8-1.8-2,0-.4,0-.9,0-1.3-.7-4.8,0-4.5,2.8-4.9,4-.4,8.1-.7,12.1-.8,2,0,4.1,0,6.1-.1,1.5,0,3.3,0,4.8.3l1.5.3c0,0-.2,3.1-.2,3.2.6.9.4,2.2-.8,2.8Z"/><path fill="currentColor" d="M458.1,113.3c-.1,1.5,0,3.1,0,4.7,0,.8,0,1.5,0,2.3,0,.5,0,1.1,0,1.6-.4,1.4-1.7,1.5-2.7,1.3-.3,0-.5-.2-.8-.2-.4,0-.7,0-1,0-.5,0-1.1-.3-1.6-.4-1.2-.3-2.4-.3-3.6-.6-1.2-.3-2.5-.4-3.8-.4-2.7,0-5.3,0-8,.3-1.3.1-2.5.2-3.8.3-1.2.2-2.4.4-3.6.5-1.3,0-2.5,0-3.8-.2-1.1,0-2.3.2-3.4,0-.4,0-.8-.5-.8-1-.5-2.8.4-5.6.7-8.4,0-.7,0-1.5,0-2.2s0-1.6.1-2.3c.1-1.5.2-2.9.2-4.4,0-1.4.1-2.9.2-4.3,0-1.3,0-2.7,0-4,0-.6.2-1.3.2-1.9,0-.6,0-1.3,0-1.9,0-1.3.2-2.7.2-4,0-2.8.2-5.5.5-8.3.2-2.8.3-5.5.3-8.4,0-2.7.1-5.5.2-8.2,0-2.8.4-5.6.4-8.4,0-2.8,0-5.6,0-8.4,0-1.4.2-2.7.5-4.1.1-.7.2-1.3.3-2,0-.3,0-.6,0-.9,0-.6,0-1.3.2-2,.1-.5.4-.9.8-1.2.3-.3.7-.5,1-.4.3,0,.5,0,.8-.2,1.1-.4,2.3-.4,3.4-.3,1.1.1,2.4.2,3,1.4.3.6.2,1.3.1,2,0,.8-.1,1.5-.2,2.3-.1,1.5-.3,3-.4,4.5-.2,3,0,6.1-.1,9.1-.3,6.2-.5,12.3-.4,18.5,0,3.1.1,6.2,0,9.3,0,3.1-.1,6.2,0,9.3,0,3.1.4,6.1.4,9.2,0,1.5,0,3,0,4.5,0,.2,0,.3,0,.5.3,0,.5,0,.8,0,1.5.2,2.9,0,4.4,0,1.4,0,2.8.2,4.3.3,1.5,0,2.9.2,4.4.4,1.2.2,2.3.6,3.5.9,1.3.3,2.6.3,3.8.6.9.2,2.5.4,3,1.4.5,1,.2,2.5,0,3.6Z"/><g><path fill="currentColor" d="M500,110.6s0,2.7,0,2.7c0,0,0,.2,0,.2-.2,1.1-1.3,1.6-2.3,1.8-1.5.2-1.3-.2-2.8-.2-1.4,0-2.7,0-4.1-.1-.2,0-.4,0-.6,0-.7,0-1.3,0-2,0-2,0-3.9.3-5.9.4-2.8,0-5.1.2-7.9.2-2,0-3.9,1.4-3.9-.8,0-.9.5-5.1.5-5.1,0,0,2.7-.4,4-.3,2.5.2,3.4.4,5.9.4,0-1.1,0-2.3,0-3.4,0-.6,0-1.1,0-1.7-.1-2-.7-4-.8-6-.3-4,.6-8,.6-12,0-4.3.7-6.1.3-10.4-.3-2.6-.7-5.9-.5-8.9-.4,0-.9,0-1.3,0-2,0-3.8-.3-5.8.2-2.6.6-4.5-1-4.8-3.5,0-.5.1-1.3,0-1.8-.5-1.5-.2-4.8-.2-4.8,1.5-.9,5,0,6.7,0,2.4,0,4.1,0,6.5.2,2.6.3,5.2.2,7.8.1,2.5,0,3.3.5,5.8.5.9,0,3.9.3,4.4.7,0,0,.7,6.7-3.5,7.2-2,.2-2.2.7-4.3.7-1.4,0-2.9.2-4.3.3,0,3.1,0,6.2-.3,9.3-.4,4,.2,5.4.3,9.5.2,8-.8,15.9-.8,23.9,4.2,0,6.7.4,10.9.3q1.9,0,2.3.5Z"/><path fill="currentColor" d="M551.6,77.2c-.4,2.6-2.9,3.8-5.1,4.9-.6.3-1.3.6-2,.9-.6.2-1.3.3-1.9.5-.6.2-1.1.6-1.7.8-.6.2-1.3.3-1.9.4-.9.1-1.7.2-2.6.3,1.3.2,2.6.5,3.8,1.2.9.5,1.8,1.2,2.5,2,.6.7,1.2,1.5,1.7,2.3,1,1.7,1.3,3.8,1.4,5.7,0,2.4-.1,4.8-.1,7.1,0,2.2,0,4.5-.4,6.7-.2,1.9-.8,4.2-2.6,5.3-1,.6-2.1.2-3.2.4-.6.1-1.2.4-1.8.5-.6,0-1.1.2-1.7.2-1.1.1-2.3.1-3.4.3-1.2.2-2.4.4-3.7.6-1.2.1-2.3.4-3.5.4-1.2,0-2.4,0-3.7,0-1.2,0-2.4,0-3.6,0-1.1,0-2.3,0-3.4-.2-.8-.1-1.6-.3-2.3-.6-1-.4-1.1-1.1-.9-2,.2-1.1,0-2.3,0-3.4,0-1.1,0-2.2.1-3.3.1-2.4,0-4.8,0-7.2,0-1.2,0-2.4,0-3.6,0-1.2.2-2.3.2-3.5,0-1.1,0-2.3,0-3.4,0-.6,0-1.3,0-1.9,0-.6.1-1.1.2-1.7,0-1.1,0-2.3,0-3.4,0-1.1,0-2.3,0-3.4-.2-2.1-.5-4.2-.3-6.3.1-1.1.5-2.3.7-3.4.2-1.2.4-2.4.4-3.6,0-1.1.1-2.1.2-3.2,0-.4.2-.9.2-1.3,0,0,0,0,0-.1,0,0,0-.2,0-.3v-.2c0-.3.1-.6.4-.7.6-.3,1.2-.3,1.9-.4.7,0,1.5,0,2.2,0,.8,0,1.6,0,2.3,0,.7,0,1.4-.3,2.2-.3,1.5,0,2.9-.3,4.4-.3,1.7,0,3.3,0,5,.2,1.4,0,2.8.2,4.2.3,1.4,0,2.8,0,4.2.2,1.4.2,2.9.4,4.2.8,1.1.3,2.2.9,3.2,1.5,2.2,1.5,2.8,4.1,3.2,6.5.2,1.4.4,2.9.6,4.3.2,1.2.6,2.3.4,3.5ZM534.3,99.2c0-.6-.3-1.2-.4-1.9-.1-.6-.2-1.2-.2-1.7-.1-1.1-.3-1.9-1.4-2.4-.5-.3-1.1-.1-1.7-.2-.7,0-1.4-.1-2.1-.1-2.2,0-4.5.2-6.7.2,0,2,.1,4,0,6-.1,1.5-.3,3-.3,4.5,0,1,0,2,0,3,.2,0,.5,0,.7,0,.8,0,1.6,0,2.4,0,.8,0,1.6,0,2.4-.1.8-.2,1.6-.3,2.4-.4.7,0,1.4-.2,2.1-.3.4,0,.8-.1,1.2-.2.3,0,.6,0,.9-.1.5-.2.6-1.5.7-2.1.2-1.3,0-2.8,0-4.1ZM538.4,76.7s0,0,0,0c0,0,.2,0,.2,0-.1-.1-.2-.2-.3-.2,0-.2,0-.4,0-.5,0-.7.2-1.3.1-2,0-.7-.2-1.4-.2-2.1,0-.7,0-1.3-.2-2,0-.2-.1-.4-.2-.7,0,0,0-.2-.1-.3-.3,0-.6-.3-.8-.4-.3-.1-.7-.2-1-.2-.7,0-1.3-.1-2-.1-1.5,0-3,.1-4.4.1-1.4,0-2.8.1-4.2.2-.7,0-1.3,0-2-.2-.2,0-.3,0-.5,0,0,.5,0,1-.1,1.5-.1.8-.2,1.6-.2,2.4,0,.8,0,1.7,0,2.5,0,.7-.1,1.3,0,2,0,.5,0,1,0,1.5,0,0,.1,0,.2,0,.9,0,1.8,0,2.7,0,.8,0,1.6-.2,2.5-.3,1.6-.1,3.2.1,4.8-.2,1.4-.3,2.8-.4,4.1-.7.5-.1,1-.1,1.5-.2,0,.2.2.5,0,0,0,0,0,0,0,0ZM538.4,76.4c0,0,0,.2,0,.2,0,0,0,0,0,0,0-.1,0-.2,0-.2Z"/><path fill="currentColor" d="M608.5,114.7c-.5.4-2.5,1.7-3.1,1.9-.2,1-1.4,1.7-2.3,1.7,0,0,0,0,0,0-1.1.9-2.9,1-3.6-.5-.2-.4-.5-.9-.7-1.3-2.1-1.5-4.1-3.4-5.8-5.1-2.5-2.5-5-5-7.6-7.4-2.3-2.2-4.6-4.6-6.6-7.1-1.4-1.5-2.8-3-4.2-4.5-.8,3.5-1.1,7.1-1.4,10.7-.3,3.5-.9,7-.9,10.5,0,2.5.4,6.6-2.5,7.7-.9.4-1.9.3-2.7,0-.2,0-.4,0-.6,0-1.8.5-2.7,1.6-3-.7-.3-2.1-.3-5.7-.2-7.7.2-2.5,1,1.1,1.2-1.4.2-2.6.6-12.7.8-15.3.2-2.2,0-4.3.5-6.5.9-4.8.9-9.7,1.7-14.6.7-4.4.5-8.8,1.1-13.2.1-.9.3-2.6.3-2.6,0,0,2,.2,2.7.2.6,0,1.2,0,1.8,0,.3,0,.5,0,.8,0,.2,0,.5,0,.8,0,.6,0,1.1.1,1.6.3,1.8,0,3.6-.1,5.3,0,3,.3,6,.6,9.1.9,3.7.3,7.4,1.4,9.2,4.1,3.4,3.9,2,12.4,1,16.3-.9,3.5-3.9,5.7-7.4,6.6-2.7.7-6.2,1-9.2.3.8.9,1.4,1.7,2.3,2.5,1.2,1.1,2.2,2.4,3.5,3.5,1.3,1.1,2.6,2,3.8,3.2,2.5,2.6,4.9,5.6,7.1,8.5,2,2.5,5.4,4.6,6.5,7.6.3.7,1.5.8.9,1.3ZM577.7,76.8c.7,0,1.5.2,2.2.2,1.2,0,2.3,0,3.5,0,.2,0,.5-.1.7-.2,1.2-.3,2.8-.2,3.9-.7,0,0,0,0,0,0,.3-.2.5-.5.8-.8.5-.9.3-2.3.3-3.4,0-1-.2-1.7-.5-2.3-2.3-1.4-6.7-1.3-9.6-.8,0,.2,0,.4,0,.6-.4,2.4-.8,4.9-1.2,7.3Z"/><path fill="currentColor" d="M666.7,116.7c-.1.2-.3.3-.4.5-.6.2-1.2.4-1.8.6-.6.2-1.2.3-1.7.4-.2,0-.3,0-.5.1,0,0-.2,0-.3,0-.3,0-.7.1-1,.2-.8,0-1.4-.7-1.5-1.5,0-1.1-.6-1.9-1-2.8-.6-1.2-.9-2.4-1.3-3.6-.4-1.3-1-2.5-1.5-3.8-.2-.5-.4-.9-.6-1.4-.4,0-.8,0-1.2,0-1.3,0-2.6,0-3.9.2-2.3.2-4.7.2-7,.4-2.3.2-4.7.4-7,.6-2.3.2-4.7.5-7,.8-1.1.1-2.3.3-3.4.5-.2,0-.5.1-.7.1-.3,1.5-.6,3.1-1,4.6,0,.1,0,.3,0,.4,0,.3-.2.6-.3.9-.3.6-.5,1.1-.7,1.7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0-.3.8-.5,1.6-.6,2.4,0,0-.1,0-.2.1,0,0,0,0,0,0-2-.3-3.9-.6-5.9-.8,0,0,0-.1,0-.2,0,0,0,0,0,0,1.5-3.8,3.6-7.5,4.2-11.5.1-.3.3-.6.5-.9.5-.8.7-1.8,1-2.7.7-1.9,1.1-4,1.9-5.8.1-.7.3-1.5.6-2.1.2-.3.4-.6.6-1,.2-.3.3-.7.6-1,.1-.2.2-.3.3-.5.3-.8,7.2-18.9,7.3-19.5,1.6-3.1,2.9-6.3,3.8-9.6.3-.5.5-1,.8-1.6,0,0,0,0,0-.1,1.3-2.1,2.7-4.1,3.9-6.3,0,0,.2-.1.3-.2.3-.2.7-.2,1-.1.4.9,1,1.7,1.4,2.5,0,.1.1.2.2.3,0,.2,0,.3.1.5.6,1.7,1.4,3.3,2.2,4.9.1.3.2.6.4.9.2.4.6.5.9.3.7,1.5,1.3,3.1,1.7,4.8.6,1.9,1.3,3.9,2.1,5.8.9,2,1.6,4,2.3,6,1.3,4,3,7.9,4,12,1,4.2,2.4,8.3,4,12.3.4,1,.8,2,1.2,2.9.4.9.6,1.9.9,2.8.1.3.2.6.3,1,.3.5.6.9.9,1.4.4.6.7,1.2,1,1.9.3.7.6,1.5.2,2.2ZM651,96.1c0-.1-.1-.3-.2-.4-.5-1.2-.9-2.5-1.4-3.8-.5-1.2-1-2.3-1.5-3.5-.9-2.5-1.3-5.2-2.1-7.8-.4-1.3-.7-2.6-1.1-3.9-.4-1.3-.9-2.5-1.1-3.8-.1-.7-.2-1.3-.3-2,0-.5-.3-1-.4-1.5-.1-.7-.3-1.3-.5-1.9-.2-.5-.5-1-.7-1.5,0,0,0,0,0-.1-.1.2-.3.5-.5.7-.7,1.1-1.3,2.3-1.8,3.4-.5,1.1-1,2.3-1.5,3.4-.8,2.2-1.7,4.3-2.4,6.5-.7,2.3-1.4,4.5-2.3,6.7-.9,2.2-2,4.4-3,6.5-.5,1-1.1,2-1.5,3.1-.3.9-.6,1.8-1,2.7,1.1-.3,2.2-.5,3.3-.6,1.3-.1,2.6,0,4,0,1.3,0,2.7-.2,4-.4,1.3-.2,2.5-.6,3.8-.6,1.4,0,2.6-.4,4-.6.6,0,1.2,0,1.8-.2.6-.1,1.2-.3,1.8-.4.2,0,.4,0,.7,0Z"/><path fill="currentColor" d="M727.4,87.3c-.3,1.8-1.4,3.1-3,4.1-.7.4-1.4.7-2.1,1.1-.8.6-1.5.9-2.6,1-1.8.2-3.7.3-5.5.5-4,.3-7.9.6-11.8,1-.7,0-1.3.1-2,.1.7.8,1.4,1.6,2.1,2.3.9.9,1.9,1.8,2.9,2.8.4.4.8.9,1.2,1.3.5.4,1,.8,1.5,1.2,2.2,1.7,4.3,3.6,6.2,5.7.9,1,1.6,2,2.5,2.9.5.5.8,1,1.3,1.3.5.4,1,.7,1.4,1.2.4.5.8.9,1.3,1.4.4.4.8.9,1.2,1.3,0,0,0,0,.1.1,0,0,0,0,0,0-.2.3-.2.9.2,1.1.8.6,1.6,1.2,2.4,1.8-1.3,1.3-2.7,2.5-4.1,3.8,0,0-.2,0-.3.1-1,.4-1.9,0-2.8-.6-.8-.5-1.6-1.1-2.3-1.7-1.4-1.1-2.7-2.2-3.9-3.5-1.3-1.4-2.6-2.7-4-4-1.4-1.3-2.8-2.6-4.2-3.9-1.4-1.2-2.7-2.6-4.2-3.7-1.4-1.1-2.8-2.3-4.1-3.5-1.3-1.2-2.4-2.7-3.7-4-1.4-1.4-2.8-2.6-4-4.2,0,0,0,0,0,0-.7,0-1.5,0-2.2,0-1,0-2,0-2.9-.1,0,.6,0,1.1,0,1.7,0,.9-.1,1.8-.1,2.7,0,2,.1,3.9.2,5.9,0,1.9.2,3.9.2,5.8,0,1,0,2-.1,2.9,0,.4-.1.8,0,1.1,0,.4.3.8.3,1.2,0,.4-.3.9-.7,1-1,.2-2,0-3.1,0-.9,0-1.9.1-2.8,0-.3,0-.5,0-.8-.2,0-.8.2-1.5.2-2.3,0-.7-.5-1.2-1.2-1.3,0-.2,0-.3,0-.5,0-.9.2-1.8.2-2.8,0-.9,0-1.8.2-2.8.1-1.9.1-3.8.2-5.7.1-1.9.3-3.7.4-5.6,0-1.9,0-3.8,0-5.7s0-3.8.4-5.6c.2-.9.3-1.7.3-2.6,0-.9,0-1.9,0-2.8,0-1.8-.2-3.5-.2-5.3,0-.9,0-1.7.1-2.6,0,0,0-.1,0-.2,0-.4.1-.7.1-1.1.1-.7.2-1.3.4-2,1.2,0,2.5,0,3.6,0,1.3,0,2.5,0,3.7-.1,0,0,0,0,0,0,.8,0,1.7-.1,2.5-.1,2.2,0,4.4,0,6.6-.2,2.2,0,4.3.2,6.4.4,2.1.1,4.3.3,6.5.3,3.8,0,7.6.4,11.4.6,1.8,0,3.5.2,5.2.8.8.3,1.7.4,2.5.9.6.3,1.1.8,1.6,1.3,1.2,1.3,1.5,3.1,1.7,4.8.2,1.9,0,3.7-.2,5.5,0,1.8.3,3.6,0,5.4ZM716.3,80.8c0-.8-.4-1.5-.6-2.3,0,0,0,0,0,0-.1,0-.3,0-.4,0-.6,0-1.3,0-1.9,0-2.7.4-5.5.2-8.3.3-1.3,0-2.7-.1-4-.1-1.4,0-2.8,0-4.2,0-2.7,0-5.3-.5-8-.5-1.4,0-2.8,0-4.1,0-.6,0-1.2,0-1.7.2,0,0-.2,0-.2,0-.1,1.1-.2,2.1-.2,3.2,0,.1,0,.2,0,.3,1,0,2,0,3,0,1.6,0,3.2,0,4.8,0,1.5,0,3,0,4.6,0,1.4,0,2.7-.2,4.1-.2,1.4,0,2.7-.2,4.1-.2,1.4,0,2.8,0,4.2,0,1.3,0,2.6-.2,3.8-.2,1.1,0,2.2.2,3.4.2.5,0,.9,0,1.3-.3.1,0,.2-.2.3-.2,0,0,0,0,0-.1Z"/><path fill="currentColor" d="M786.7,59.3c-.2,1.6-2.4,4.8-3.3,6.2-1.4,2.3-2.7,4.7-4,7.1-1.2,2.3-2.3,4.6-3.5,6.9-1.3,2.4-3,4.5-4.4,6.8-1.4,2.4-2.6,5.3-4,7.9-.8,7.2-.3,16.1-.3,23.3,0,1.2-2.7.9-4,.9-1.6,0-3.9.7-5.6.3-1,.2-1.9.2-2.8-.2-.8-.4-1.2-1.2-1.2-2,0-4,.4-8.1.9-12.1,0-2,0-4.1.1-6.1,0-.9.2-1.8.3-2.7,0-.3,0-.7,0-1,0-.1,0-.2,0-.3-2.2-4.2-3.8-8.8-6.2-13-3.3-5.8-6-11.8-9.5-17.5-1.3-2.2-1.6-2.9,3.2-3.3.8-.5,1.9-.4,2.9.3,1.3,1,1.9,2.4,2.4,3.8.2.2.3.4.4.6.8,1.3,1.6,2.7,2.3,4.1,1.4,2.8,3.1,5.4,4.6,8.2,1.6,2.9,2.9,5.9,4.4,8.8.5,1.1,1.3,1.9,1.9,2.9.2.3.3.6.5.9.8-1.4,1.5-2.8,2.2-4.3,1.7-3.9,3.1-7.8,5.3-11.5,2.3-4,4.9-8.4,6.4-12.8.5-1.4.9-3.1,2.6-3.6.9-.2,1.4-.3,2.2-.2,1.1.1,2.3.5,3.5.5,1.7,0,3.1-.1,2.9,1.4Z"/></g></g><g><path fill="currentColor" d="M63.2,20.1c-9.6,4.9-20.6,5.6-31.1,3.5,1.1-1.9,5.3-3.5,10.3-4.5.4.4.8.7,1.1,1,.2.2.7.6.8.8,1.6,1.8,4.7,1.5,6-.5.5-.8,1-1.7,1.5-2.5,5.3-.2,9.9.4,11.3,2.1Z"/><path fill="currentColor" d="M52.4,10h0c0,.8-.2,1.5-.5,2.3,0,0,0,0,0,0,0,.1,0,.2-.1.4,0,.2-.1.4-.2.6-.3.8-.7,1.6-1.1,2.4,0,.2-.2.4-.3.6,0,.1-.1.2-.2.4-.3.5-.6,1-.8,1.5-.1.2-.2.4-.3.6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0-.1.2-.2.3,0,0,0,0,0,0,0,0,0,0,0,.1,0,0-.1.1-.2.2,0,0-.1.1-.2.2t0,0c-.1,0-.2.1-.4.2,0,0-.1,0-.2,0,0,0-.1,0-.2,0,0,0,0,0-.1,0h0c-.4,0-.8-.3-1.2-.6,0,0,0,0,0,0-.3-.2-.5-.5-.8-.7h0s0,0,0,0c-1-.9-1.8-1.7-2.5-2.5-.1-.1-.2-.3-.3-.4,0,0,0,0,0,0-1.1-1.5-1.6-3-1.2-4.6,0,0,0,0,0,0,0,0,0,0,0,0,.2-.7.6-1.4,1.1-2.2,0,0,.1-.2.2-.3.1-.2.3-.4.4-.5.2-.2.4-.4.6-.6h0c.6-.5,1.1-1,1.5-1.6,0,0,.1-.2.2-.3.5-.7,1-1.5,1.3-2.6,0,0,0-.2,0-.2,0,0,0,0,0,0,.2-.7.3-1.4.4-2.1v-.2s.6-.2.6-.2c.3.4.6.8.9,1.2.3.4.5.7.8,1.1.5.7.9,1.3,1.3,2,.2.4.4.7.6,1.1.2.3.3.7.5,1,0,.2.2.4.2.6,0,.2.1.3.2.5h0c0,.1,0,.3.1.4,0,.2,0,.3.1.5,0,0,0,0,0,.1,0,.2,0,.5.1.7,0,.2,0,.4,0,.6h0c0,0,0,.1,0,.2Z"/><path fill="currentColor" d="M105.5,91.6c-.3-3.2-1.1-6.4-2.1-9.5-.5-1.7-1.1-3.6-1.8-5.2-1.6-3.3-4.5-5.6-6.7-8.6-3.4-4.5-5.9-9.6-9.2-14.2-.5-.8-1.6-.7-2.3,0,0,0,0,0,0,0-.8.7-1.8.8-2.6.8-2.4,0-4.7-1-7.1-1.4-3.5-.6-6.9-.6-8.9,1.8-.3.4-.5.7-.7,1.2-1.1,2.4-3.7,4-6.2,4.2-6.9.7-11.3-4.5-17.6-1.5-2,.9-4.6,2.4-7.2,2.6-4,.3-7.5-2.4-11.4-1.6-1,.3-2.4.8-3.6.8-2,.2-3.9.8-6.1.4h-.5c-1.4,1.4-2.7,3-3.9,4.7,0,0-.1.2-.2.2l-.2.2s0,0-.1,0c-.6.9-1.1,1.9-1.6,2.8,0,0,0,.1,0,.2-.6,1.2-1.2,2.4-1.7,3.6-4.8,12.9-5.4,17.7-.6,29.8,8.3,20.7,26.1,35.5,29.2,37,3.4,1.6,20-4.3,23.7-3.9,3.1.3,5.1,3.7,6.3,6.2.6,1.2,2.1,7.6,3.3,7.8.8.1,1.6-.1,2.5-.4.4-.1.7-.2,1.1-.3,1.2-.3,2-.6,2.4-.8-.2-.7-.6-1.6-.8-2.3-1-2.5-1.6-4.8-1.7-7.5,2.6-1.1,3.6,5.1,4.1,6.5.3,1,.7,1.9,1,2.7,1-.3,2.6-.8,4.3-1.3,1.6-.5,3.3-1.1,4.2-1.4-.4-1.2-.7-2.4-1.2-3.5-.4-1-.9-1.6-1.1-2.6-.1-.7-.5-4.9,1.2-3.8,1.1.6,1.4,2.2,1.8,3.3.3,1.2.8,2.3,1.2,3.5.2.8.6,1.9.9,2.5.4-.1.8-.2,1.4-.4,1.5-.4,4.7-1.2,6.1-1.7,0-.5-.3-1.3-.7-2.3-.5-1.5-.9-3.1-1.1-4.7,0-.6,0-1.2.5-1.7.6-.5,2.9,5.1,3.1,5.6.5,1,.7,2.1,1.8,2.2,1.3.2,2.7-.8,3.9-1.4,1.2-.6,2.5-1,2.9-2.4.6-2.1-.5-4.2-1.8-5.7-1.4-1.7-2.5-3.7-3.3-5.8-.9-2.5-3.1-12.9-3-13.7.5-3.3,2.5-5.7,5.6-7.1,2.5-1.1,3.8-3.3,4-6.2,0-1.3-.1-2.7.2-4,.2-1.3.4-2.2.3-3.6ZM69.3,101.8c-.3,11.3-13.2,20.1-23.1,9.8-5.9-5.9-6.8-17.5.8-22.3,9.3-6,21.4,1.8,22.3,12.3v.2ZM80.8,115.6c-5.1-14.2-.4-15.9,4.4-1.1.8,2.7-3.5,3.8-4.4,1.1ZM98.7,100.6h-.1c-5.6,7.8-15.7,1.5-17.7-8-2.6-10,4.7-20.9,14-14.6,7.2,4.2,8.8,16.3,3.9,22.6Z"/><path fill="currentColor" d="M82.2,50c.1,1.3,0,2.6-1.3,2.6s0,0,0,0c-2.3-.1-4.5-1.1-6.7-1.6-3.7-1-8.5-1.2-11.1,2.1-.5.6-.9,1.3-1.3,1.9-2,2.6-5.8,2.4-8.6,1.6-8.5-2.9-10-2.8-17.9,1.4-4.5,2-9.3-1.9-13.9-.5-1.5.6-2.9.8-4.5,1-1.4.3-2.7.6-4,.4-2.5-3.1,11.8-14.2,15.7-16.4,1.1-.6,1.6-1.5,1.9-2.4,0,0,0,0,0,0,0-.2.1-.4.1-.5,0-.2,0-.3,0-.5,0-.9,0-1.8,0-2.8,0-.3,0-.5,0-.8.1-3,.2-6.2.1-9.2,0-.5.4-.8.8-.6,8,2.2,16.9,2.3,24.9-.3,2.6-.8,5-1.9,7.4-3.1.5.6.4,1.7.3,2.8,0,1.3.1,2.5.2,3.8l.2,3.7c0,1.9,0,4,1.2,5.7,1.8,2.8,15.7,5.3,16.3,11.6Z"/></g></svg>`;

/**
 * Normalize server URL to standard format:
 * - Adds https:// if no protocol specified
 * - Removes trailing slashes
 * - Validates basic URL structure
 */
function _normalizeServerUrl(url: string): { normalized: string; corrected: boolean; error?: string } {
  let normalized = url.trim();
  let corrected = false;

  if (!normalized) {
    return { normalized: '', corrected: false, error: 'Please enter a server URL' };
  }

  // Add protocol if missing
  if (!normalized.match(/^https?:\/\//i)) {
    // Check if it looks like it has a protocol but wrong format
    if (normalized.includes('://')) {
      return { normalized, corrected: false, error: 'Invalid URL protocol. Use http:// or https://' };
    }
    // Default to https for security
    normalized = `https://${normalized}`;
    corrected = true;
  }

  // Remove trailing slashes
  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
    corrected = true;
  }

  // Basic URL validation
  try {
    const parsed = new URL(normalized);
    if (!parsed.hostname) {
      return { normalized, corrected: false, error: 'Invalid server URL' };
    }
  } catch {
    return { normalized, corrected: false, error: 'Invalid server URL format' };
  }

  return { normalized, corrected };
}

export function LoginScreen() {
  const { login, isLoading, error, clearError } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [urlCorrectionMsg, setUrlCorrectionMsg] = useState('');

  // Real-time URL validation status
  type UrlStatus = 'empty' | 'valid' | 'correctable' | 'invalid' | 'checking';

  // Synchronous URL format check
  const urlFormat = useMemo<{ ok: boolean; normalized?: string; corrected: boolean; error?: string }>(() => {
    const trimmed = serverUrl.trim();
    if (!trimmed) return { ok: false, corrected: false };

    if (trimmed.includes('://') && !trimmed.match(/^https?:\/\//i)) {
      return { ok: false, corrected: false, error: 'Use http:// or https://' };
    }

    let normalized = trimmed;
    let corrected = false;
    if (!normalized.match(/^https?:\/\//i)) {
      normalized = `https://${normalized}`;
      corrected = true;
    }
    while (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
      corrected = true;
    }

    try {
      const parsed = new URL(normalized);
      if (!parsed.hostname) return { ok: false, corrected: false, error: 'Enter a valid hostname' };
      return { ok: true, normalized, corrected };
    } catch {
      return { ok: false, corrected: false, error: 'Invalid URL format' };
    }
  }, [serverUrl]);

  // Async ABS server verification
  const [absCheckStatus, setAbsCheckStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const absCheckTimer = useRef<ReturnType<typeof setTimeout>>();
  const absCheckAbort = useRef<AbortController>();

  useEffect(() => {
    // Reset on URL change
    setAbsCheckStatus('idle');
    if (absCheckTimer.current) clearTimeout(absCheckTimer.current);
    if (absCheckAbort.current) absCheckAbort.current.abort();

    if (!urlFormat.ok || !urlFormat.normalized) return;

    const normalizedUrl = urlFormat.normalized;
    // Debounce 600ms before checking server
    absCheckTimer.current = setTimeout(async () => {
      setAbsCheckStatus('checking');
      const controller = new AbortController();
      absCheckAbort.current = controller;
      try {
        const res = await fetch(`${normalizedUrl}/api/status`, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });
        if (controller.signal.aborted) return;
        if (res.ok) {
          const data = await res.json();
          // ABS returns { isInit, authMethods, ... }
          if (data && (data.isInit !== undefined || data.authMethods !== undefined)) {
            setAbsCheckStatus('valid');
          } else {
            setAbsCheckStatus('invalid');
          }
        } else if (res.status === 401 || res.status === 403) {
          // Server exists but requires auth — likely ABS behind a reverse proxy
          setAbsCheckStatus('valid');
        } else {
          setAbsCheckStatus('invalid');
        }
      } catch {
        if (!controller.signal.aborted) {
          setAbsCheckStatus('invalid');
        }
      }
    }, 600);

    return () => {
      if (absCheckTimer.current) clearTimeout(absCheckTimer.current);
      if (absCheckAbort.current) absCheckAbort.current.abort();
    };
  }, [urlFormat.ok, urlFormat.normalized]);

  // Combined validation status
  const urlValidation = useMemo<{ status: UrlStatus; message: string; normalized?: string }>(() => {
    const trimmed = serverUrl.trim();
    if (!trimmed) return { status: 'empty', message: '' };
    if (!urlFormat.ok) return { status: 'invalid', message: urlFormat.error || 'Invalid URL' };

    const normalized = urlFormat.normalized!;
    if (absCheckStatus === 'checking') {
      return { status: 'checking', message: 'Checking server...', normalized };
    }
    if (absCheckStatus === 'valid') {
      const msg = urlFormat.corrected ? `Will connect to ${normalized}` : 'Audiobookshelf server found';
      return { status: urlFormat.corrected ? 'correctable' : 'valid', message: msg, normalized };
    }
    if (absCheckStatus === 'invalid') {
      return { status: 'invalid', message: 'Not an Audiobookshelf server', normalized };
    }
    // idle — format is ok but not yet checked
    if (urlFormat.corrected) {
      return { status: 'correctable', message: `Will connect to ${normalized}`, normalized };
    }
    return { status: 'empty', message: '', normalized };
  }, [serverUrl, urlFormat, absCheckStatus]);

  // Load saved login info
  useEffect(() => {
    loadSavedLoginInfo();
  }, []);

  // Clear errors when inputs change
  useEffect(() => {
    if (validationError) {
      setValidationError('');
    }
    if (urlCorrectionMsg) {
      setUrlCorrectionMsg('');
    }
    // Also clear auth errors when user makes changes
    if (error) {
      clearError();
    }
  }, [serverUrl, username, password]);

  const loadSavedLoginInfo = async () => {
    try {
      const [savedUrl, savedUsername] = await Promise.all([
        AsyncStorage.getItem(SAVED_SERVER_URL_KEY),
        AsyncStorage.getItem(SAVED_USERNAME_KEY),
      ]);
      // Also try the auth service for last used URL as fallback
      if (!savedUrl) {
        const { authService } = await import('@/core/auth');
        const lastUrl = await authService.getStoredServerUrl();
        if (lastUrl) setServerUrl(lastUrl);
      } else {
        setServerUrl(savedUrl);
      }
      if (savedUsername) setUsername(savedUsername);
    } catch (err) {
      logger.error('[Login] Failed to load saved login info:', err);
    }
  };

  const saveLoginInfo = async (url: string, user: string) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(SAVED_SERVER_URL_KEY, url),
        AsyncStorage.setItem(SAVED_USERNAME_KEY, user),
      ]);
    } catch (err) {
      logger.error('[Login] Failed to save login info:', err);
    }
  };

  const validateInputs = (): { valid: boolean; normalizedUrl?: string } => {
    // Use pre-computed URL validation
    if (urlValidation.status === 'empty') {
      setValidationError('Please enter a server URL');
      return { valid: false };
    }
    if (urlValidation.status === 'invalid') {
      setValidationError(urlValidation.message);
      return { valid: false };
    }

    // Show correction message if URL was auto-corrected
    if (urlValidation.status === 'correctable' && urlValidation.normalized) {
      setUrlCorrectionMsg(`Connecting to: ${urlValidation.normalized}`);
      setServerUrl(urlValidation.normalized);
    }

    if (!username.trim()) {
      setValidationError('Please enter a username');
      return { valid: false };
    }
    if (!password) {
      setValidationError('Please enter a password');
      return { valid: false };
    }
    return { valid: true, normalizedUrl: urlValidation.normalized };
  };

  const handleLogin = async () => {
    const result = validateInputs();
    if (!result.valid || !result.normalizedUrl) {
      return;
    }

    try {
      // Save login info for next time
      await saveLoginInfo(result.normalizedUrl, username.trim());
      await login(result.normalizedUrl, username.trim(), password);
    } catch {
      // Error handled by context
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background.primary, paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <SkullCandle color={colors.text.primary} size={120} />
          <SvgXml xml={LOGO_SVG.replace(/currentColor/g, colors.text.primary)} width={scale(220)} style={{ marginTop: spacing.lg }} />
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Server URL with real-time validation */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text.primary }]}>Server URL</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.background.primary, borderColor: colors.border.default, color: colors.text.primary },
                  styles.inputWithIcon,
                  urlValidation.status === 'invalid' && styles.inputError,
                  (urlValidation.status === 'valid' || urlValidation.status === 'correctable') && styles.inputValid,
                ]}
                placeholder="server.example.com:13378"
                placeholderTextColor={colors.text.tertiary}
                value={serverUrl}
                onChangeText={setServerUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!isLoading}
              />
              {/* Validation status icon */}
              {urlValidation.status === 'checking' && (
                <View style={styles.inputIcon}>
                  <ActivityIndicator size="small" color={colors.text.secondary} />
                </View>
              )}
              {urlValidation.status === 'valid' && (
                <View style={styles.inputIcon}>
                  <Check size={scale(18)} color={colors.text.primary} strokeWidth={2.5} />
                </View>
              )}
              {urlValidation.status === 'correctable' && (
                <View style={styles.inputIcon}>
                  <AlertCircle size={scale(18)} color={colors.text.primary} strokeWidth={2} />
                </View>
              )}
              {urlValidation.status === 'invalid' && (
                <View style={styles.inputIcon}>
                  <X size={scale(18)} color={colors.text.primary} strokeWidth={2.5} />
                </View>
              )}
            </View>
            {/* Inline validation message */}
            {urlValidation.message && urlValidation.status !== 'empty' && (
              <Text
                style={[
                  styles.inlineMessage,
                  { color: colors.text.secondary },
                ]}
              >
                {urlValidation.message}
              </Text>
            )}
          </View>

          {/* Username */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text.primary }]}>Username</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background.primary, borderColor: colors.border.default, color: colors.text.primary }]}
              placeholder="Enter username"
              placeholderTextColor={colors.text.tertiary}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          {/* Password with visibility toggle */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text.primary }]}>Password</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background.primary, borderColor: colors.border.default, color: colors.text.primary }, styles.inputWithIcon]}
                placeholder="Enter password"
                placeholderTextColor={colors.text.tertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.inputIcon}
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showPassword ? (
                  <EyeOff size={scale(18)} color={colors.text.secondary} strokeWidth={2} />
                ) : (
                  <Eye size={scale(18)} color={colors.text.secondary} strokeWidth={2} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* URL Correction Notice */}
          {urlCorrectionMsg ? (
            <Text style={[styles.correctionText, { color: colors.text.secondary }]}>{urlCorrectionMsg}</Text>
          ) : null}

          {/* Validation Error */}
          {validationError ? (
            <View style={[styles.errorContainer, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
              <AlertCircle size={scale(16)} color={colors.text.primary} strokeWidth={2} />
              <Text style={[styles.errorText, { color: colors.text.primary }]}>{validationError}</Text>
            </View>
          ) : null}

          {/* Auth Error (from server) */}
          {error && !validationError ? (
            <View style={[styles.errorContainer, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
              <AlertCircle size={scale(16)} color={colors.text.primary} strokeWidth={2} />
              <Text style={[styles.errorText, { color: colors.text.primary }]}>{error}</Text>
            </View>
          ) : null}

          {/* Login Button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={isLoading}
            style={[
              styles.loginButton,
              {
                borderWidth: 1,
                borderColor: colors.text.primary,
                borderRadius: radius.md,
                paddingVertical: spacing.md + 2,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isLoading ? 0.5 : 1,
              },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.text.primary} />
            ) : (
              <Text style={{ color: colors.text.primary, fontSize: 16, fontWeight: '600' }}>Login</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Help Text */}
        <View style={styles.footer}>
          <Text style={[styles.helpText, { color: colors.text.tertiary }]}>
            The server URL is the address of your Audiobookshelf server (e.g. https://abs.example.com). If you don't have it, ask your server administrator.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  // subtitle removed — replaced by SVG logo
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  input: {
    fontSize: 15,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  inputWrapper: {
    position: 'relative',
  },
  inputWithIcon: {
    paddingRight: scale(44),
  },
  inputIcon: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputError: {},
  inputValid: {},
  inlineMessage: {
    fontSize: 12,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  inlineMessageSuccess: {},
  inlineMessageError: {},
  loginButton: {
    marginTop: spacing.xs,
  },
  correctionText: {
    fontSize: 13,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  helpText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
