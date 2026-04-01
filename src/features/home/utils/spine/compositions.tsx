/**
 * src/features/home/utils/spine/compositions.tsx
 *
 * 12 generative spine composition layouts ported from spine-playground.jsx.
 * Each composition renders title + author + decorative elements
 * within a spine of given dimensions.
 */

import React from 'react';
import { View, Text, StyleSheet, type DimensionValue } from 'react-native';
import { fg, fg2, fgS, rc } from './genreVisualConfig';
import { hashString, hashToBool, hashToPick } from './core/hashing';

// =============================================================================
// TYPES
// =============================================================================

export interface CompositionProps {
  w: number;
  h: number;
  title: string;
  author: string;
  titleFont: string;
  authorFont: string;
  isDark: boolean;
  hash: number;
  isHorizontalDisplay: boolean;
}

type CompositionFn = (props: CompositionProps) => React.ReactElement;

// =============================================================================
// TEXT HELPERS
// =============================================================================

function splitTitle(title: string): string[] {
  const w = title.split(' ');
  if (w.length <= 2) return [title];
  if (w.length === 3) return [w[0], w.slice(1).join(' ')];
  const half = title.length / 2;
  let best = 1, cc = w[0].length;
  for (let i = 1; i <= w.length - 2; i++) {
    if (cc >= half) break;
    best = i;
    cc += 1 + w[i].length;
  }
  const split = Math.min(best + 1, w.length - 2);
  return [w.slice(0, split).join(' '), w.slice(split).join(' ')];
}

function splitAuthor(name: string): { first: string; last: string } {
  const p = name.trim().split(' ');
  if (p.length <= 1) return { first: '', last: name };
  return { first: p.slice(0, -1).join(' '), last: p[p.length - 1] };
}

function titleCase(t: string): string {
  return t.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

/**
 * Calculate font size constrained by both run length and perpendicular width.
 * For rotated text, fontSize is limited so lines fit within the spine width.
 */
function calcFontSize(
  spineW: number,
  numLines: number,
  maxCap: number = 20,
  minCap: number = 5.5,
): number {
  const perpPad = 10;
  const byPerp = ((spineW - perpPad) / numLines) * 0.82;
  return Math.max(minCap, Math.min(maxCap, byPerp));
}

// =============================================================================
// BUILDING BLOCKS (React Native equivalents of playground Rot/Hz/HR/VR/Dot)
// =============================================================================

/**
 * Rotated zone — positions content in an absolute zone and rotates it.
 * zone = [startFraction, endFraction] e.g. [0.04, 0.74]
 */
function RotatedZone({
  children,
  h,
  zone,
  rot = -90,
  align = 'center',
}: {
  children: React.ReactNode;
  h: number;
  zone: [number, number];
  rot?: number;
  align?: 'center' | 'flex-start' | 'flex-end';
}) {
  const [z0, z1] = zone;
  const zoneHeight = (z1 - z0) * h;
  const run = zoneHeight - 10;

  return (
    <View
      style={{
        position: 'absolute',
        top: `${z0 * 100}%` as DimensionValue,
        left: 0,
        right: 0,
        height: `${(z1 - z0) * 100}%` as DimensionValue,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
      pointerEvents="none"
    >
      <View
        style={{
          width: run,
          transform: [{ rotate: `${rot}deg` }],
          alignItems: align,
          justifyContent: 'center',
          gap: 2,
        }}
      >
        {children}
      </View>
    </View>
  );
}

/**
 * Horizontal zone — positions content in an absolute zone, stacked vertically.
 */
function HorizontalZone({
  children,
  zone,
  gap = 0,
  padding = 8,
}: {
  children: React.ReactNode;
  zone: [number, number];
  gap?: number;
  padding?: number;
}) {
  const [z0, z1] = zone;

  return (
    <View
      style={{
        position: 'absolute',
        top: `${z0 * 100}%` as DimensionValue,
        left: 0,
        right: 0,
        height: `${(z1 - z0) * 100}%` as DimensionValue,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        paddingHorizontal: padding,
        gap,
      }}
      pointerEvents="none"
    >
      {children}
    </View>
  );
}

/** Hairline horizontal rule */
function HR({ pos, isDark, inset = 18 }: { pos: number; isDark: boolean; inset?: number }) {
  return (
    <View
      style={{
        position: 'absolute',
        left: `${inset}%` as DimensionValue,
        right: `${inset}%` as DimensionValue,
        top: `${pos * 100}%` as DimensionValue,
        height: StyleSheet.hairlineWidth,
        backgroundColor: rc(isDark),
      }}
      pointerEvents="none"
    />
  );
}

/** Vertical rule */
function VR({ top, height, isDark }: { top: number; height: number; isDark: boolean }) {
  return (
    <View
      style={{
        position: 'absolute',
        left: '50%' as DimensionValue,
        top: `${top * 100}%` as DimensionValue,
        width: StyleSheet.hairlineWidth,
        height: `${height * 100}%` as DimensionValue,
        backgroundColor: rc(isDark),
        transform: [{ translateX: -0.5 }],
      }}
      pointerEvents="none"
    />
  );
}

/** Small decorative dot */
function Dot({ pos, isDark }: { pos: number; isDark: boolean }) {
  return (
    <View
      style={{
        position: 'absolute',
        left: '50%' as DimensionValue,
        top: `${pos * 100}%` as DimensionValue,
        width: 2.5,
        height: 2.5,
        borderRadius: 1.25,
        backgroundColor: rc(isDark),
        transform: [{ translateX: -1.25 }, { translateY: -1.25 }],
      }}
      pointerEvents="none"
    />
  );
}

// =============================================================================
// AUTHOR COMPONENTS
// =============================================================================

/** Author rendered vertically (rotated), with first/last name split */
function AuthorVertical({
  author,
  font,
  h,
  zone,
  rot = -90,
  isDark,
  align = 'center',
}: {
  author: string;
  font: string;
  h: number;
  zone: [number, number];
  rot?: number;
  isDark: boolean;
  align?: 'center' | 'flex-start' | 'flex-end';
}) {
  const { first, last } = splitAuthor(author);
  const [z0, z1] = zone;
  const zoneH = (z1 - z0) * h;
  const lSz = Math.max(5, Math.min(9.5, zoneH * 0.14));
  const fSz = first ? Math.min(lSz * 0.8, 7.5) : 0;

  return (
    <RotatedZone h={h} zone={zone} rot={rot} align={align}>
      {first ? (
        <Text
          style={{
            fontFamily: font,
            fontWeight: '400',
            fontSize: fSz,
            letterSpacing: 1.5,
            color: fg2(isDark),
            textTransform: 'uppercase',
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {first.toUpperCase()}
        </Text>
      ) : null}
      <Text
        style={{
          fontFamily: font,
          fontWeight: '600',
          fontSize: lSz,
          letterSpacing: 2,
          color: fgS(isDark),
          textTransform: 'uppercase',
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {last.toUpperCase()}
      </Text>
    </RotatedZone>
  );
}

/** Author rendered horizontally, with optional box border */
function AuthorHorizontal({
  author,
  font,
  w,
  zone,
  isDark,
  boxed = false,
}: {
  author: string;
  font: string;
  w: number;
  zone: [number, number];
  isDark: boolean;
  boxed?: boolean;
}) {
  const { first, last } = splitAuthor(author);
  const avail = w - 16;
  const lSz = Math.max(5, Math.min(9, avail * 0.14));
  const fSz = first ? Math.min(lSz * 0.78, 7) : 0;
  const [z0, z1] = zone;

  const inner = (
    <View style={{ alignItems: 'center', gap: 0 }}>
      {first ? (
        <Text
          style={{
            fontFamily: font,
            fontWeight: '400',
            fontSize: fSz,
            letterSpacing: 1,
            color: fg2(isDark),
            textTransform: 'uppercase',
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {first.toUpperCase()}
        </Text>
      ) : null}
      <Text
        style={{
          fontFamily: font,
          fontWeight: '600',
          fontSize: lSz,
          letterSpacing: 1.5,
          color: fgS(isDark),
          textTransform: 'uppercase',
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {last.toUpperCase()}
      </Text>
    </View>
  );

  if (boxed) {
    return (
      <View
        style={{
          position: 'absolute',
          top: `${z0 * 100}%` as DimensionValue,
          left: 0,
          right: 0,
          height: `${(z1 - z0) * 100}%` as DimensionValue,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        pointerEvents="none"
      >
        <View
          style={{
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: rc(isDark),
            paddingVertical: 4,
            paddingHorizontal: 8,
            marginHorizontal: 8,
            maxWidth: avail,
          }}
        >
          {inner}
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        position: 'absolute',
        top: `${z0 * 100}%` as DimensionValue,
        left: 0,
        right: 0,
        height: `${(z1 - z0) * 100}%` as DimensionValue,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        paddingHorizontal: 8,
      }}
      pointerEvents="none"
    >
      {inner}
    </View>
  );
}

// =============================================================================
// 12 COMPOSITIONS
// =============================================================================

/**
 * 0. CLASSIC — All caps, vertical up (-90°).
 * Generous 4% padding top, 22% for author. Title gets the middle.
 */
function c0({ w, h, title, author, titleFont, authorFont, isDark }: CompositionProps) {
  const lines = splitTitle(title);
  const sz = calcFontSize(w, lines.length, 20, 5.5);

  return (
    <>
      <RotatedZone h={h} zone={[0.04, 0.74]} rot={-90}>
        {lines.map((l, i) => (
          <Text
            key={i}
            style={{
              fontFamily: titleFont,
              fontWeight: '700',
              fontSize: sz,
              letterSpacing: 1.5,
              color: fg(isDark),
              textTransform: 'uppercase',
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.3}
          >
            {l.toUpperCase()}
          </Text>
        ))}
      </RotatedZone>
      <AuthorVertical author={author} font={authorFont} h={h} zone={[0.78, 0.98]} rot={-90} isDark={isDark} />
    </>
  );
}

/**
 * 1. AUTHOR-TOP BOXED — Framed author at top, title case below.
 */
function c1({ w, h, title, author, titleFont, authorFont, isDark }: CompositionProps) {
  const lines = splitTitle(title);
  const sz = calcFontSize(w, lines.length, 18, 5.5);

  return (
    <>
      <AuthorHorizontal author={author} font={authorFont} w={w} zone={[0.03, 0.20]} isDark={isDark} boxed />
      <RotatedZone h={h} zone={[0.24, 0.96]} rot={-90}>
        {lines.map((l, i) => (
          <Text
            key={i}
            style={{
              fontFamily: titleFont,
              fontWeight: '700',
              fontSize: sz,
              letterSpacing: 0.5,
              color: fg(isDark),
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.3}
          >
            {titleCase(l)}
          </Text>
        ))}
      </RotatedZone>
    </>
  );
}

/**
 * 2. HORIZONTAL STACKED — Size contrast drama.
 * Short words balloon up, long words stay grounded.
 */
function c2({ w, h, title, author, titleFont, authorFont, isDark }: CompositionProps) {
  const words = title.split(' ');
  const groups: string[] = [];
  let buf: string[] = [];
  for (const word of words) {
    if (buf.length && (buf.join(' ').length + word.length > 10 || word.length >= 6)) {
      groups.push(buf.join(' '));
      buf = [word];
    } else {
      buf.push(word);
    }
  }
  if (buf.length) groups.push(buf.join(' '));
  const avail = w - 16;

  return (
    <>
      <HorizontalZone zone={[0.06, 0.72]} gap={2}>
        {groups.map((g, i) => {
          const isShort = g.length <= 4;
          const maxSz = isShort ? Math.min(36, w * 0.72) : Math.min(18, w * 0.36);
          const sz = Math.max(6, Math.min(maxSz, avail / g.length * 1.2));
          return (
            <Text
              key={i}
              style={{
                fontFamily: titleFont,
                fontWeight: isShort ? '900' : '700',
                fontSize: sz,
                letterSpacing: isShort ? 3 : 1,
                lineHeight: sz * (isShort ? 0.95 : 1.2),
                color: fg(isDark),
                textTransform: 'uppercase',
              }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.3}
            >
              {g.toUpperCase()}
            </Text>
          );
        })}
      </HorizontalZone>
      <AuthorHorizontal author={author} font={authorFont} w={w} zone={[0.78, 0.96]} isDark={isDark} />
    </>
  );
}

/**
 * 3. SPLIT + RULE — Title case top, hairline + dot, author bottom.
 */
function c3({ w, h, title, author, titleFont, authorFont, isDark }: CompositionProps) {
  const lines = splitTitle(title);
  const sz = calcFontSize(w, lines.length, 17, 5.5);

  return (
    <>
      <RotatedZone h={h} zone={[0.04, 0.62]} rot={-90} align="flex-start">
        {lines.map((l, i) => (
          <Text
            key={i}
            style={{
              fontFamily: titleFont,
              fontWeight: '700',
              fontSize: sz,
              letterSpacing: 0.5,
              color: fg(isDark),
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.3}
          >
            {titleCase(l)}
          </Text>
        ))}
      </RotatedZone>
      <HR pos={0.67} isDark={isDark} inset={20} />
      <Dot pos={0.67} isDark={isDark} />
      <AuthorVertical author={author} font={authorFont} h={h} zone={[0.72, 0.96]} rot={-90} isDark={isDark} />
    </>
  );
}

/**
 * 4. AUTHOR TOP + UNDERLINE — Author header, rule, title below.
 */
function c4({ w, h, title, author, titleFont, authorFont, isDark }: CompositionProps) {
  const lines = splitTitle(title);
  const sz = calcFontSize(w, lines.length, 20, 5.5);

  return (
    <>
      <AuthorHorizontal author={author} font={authorFont} w={w} zone={[0.03, 0.14]} isDark={isDark} />
      <HR pos={0.17} isDark={isDark} inset={14} />
      <RotatedZone h={h} zone={[0.22, 0.96]} rot={-90}>
        {lines.map((l, i) => (
          <Text
            key={i}
            style={{
              fontFamily: titleFont,
              fontWeight: '700',
              fontSize: sz,
              letterSpacing: 1.5,
              color: fg(isDark),
              textTransform: 'uppercase',
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.3}
          >
            {l.toUpperCase()}
          </Text>
        ))}
      </RotatedZone>
    </>
  );
}

/**
 * 5. VERTICAL DOWN — European direction (top→bottom, +90°).
 */
function c5({ w, h, title, author, titleFont, authorFont, isDark }: CompositionProps) {
  const lines = splitTitle(title);
  const sz = calcFontSize(w, lines.length, 17, 5.5);

  return (
    <>
      <RotatedZone h={h} zone={[0.06, 0.74]} rot={90}>
        {lines.map((l, i) => (
          <Text
            key={i}
            style={{
              fontFamily: titleFont,
              fontWeight: '700',
              fontSize: sz,
              letterSpacing: 0.8,
              color: fg(isDark),
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.3}
          >
            {titleCase(l)}
          </Text>
        ))}
      </RotatedZone>
      <AuthorVertical author={author} font={authorFont} h={h} zone={[0.80, 0.98]} rot={90} isDark={isDark} />
    </>
  );
}

/**
 * 6. EXTREME SPREAD — Title high, vertical line connecting, author low.
 * Maximum negative space.
 */
function c6({ w, h, title, author, titleFont, authorFont, isDark }: CompositionProps) {
  const lines = splitTitle(title);
  const sz = calcFontSize(w, lines.length, 15, 5.5);

  return (
    <>
      <RotatedZone h={h} zone={[0.04, 0.36]} rot={-90} align="flex-end">
        {lines.map((l, i) => (
          <Text
            key={i}
            style={{
              fontFamily: titleFont,
              fontWeight: '700',
              fontSize: sz,
              letterSpacing: 1.5,
              color: fg(isDark),
              textTransform: 'uppercase',
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.3}
          >
            {l.toUpperCase()}
          </Text>
        ))}
      </RotatedZone>
      <VR top={0.40} height={0.30} isDark={isDark} />
      <Dot pos={0.55} isDark={isDark} />
      <AuthorVertical author={author} font={authorFont} h={h} zone={[0.76, 0.96]} rot={-90} isDark={isDark} />
    </>
  );
}

/**
 * 7. BOOKPLATE — Everything framed. Title case, horizontal.
 * Short centered rule between title and author.
 */
function c7({ w, h, title, author, titleFont, authorFont, isDark }: CompositionProps) {
  const words = title.split(' ');
  const groups: string[] = [];
  let buf: string[] = [];
  for (const word of words) {
    if (buf.length && buf.join(' ').length + word.length > 10) {
      groups.push(buf.join(' '));
      buf = [word];
    } else {
      buf.push(word);
    }
  }
  if (buf.length) groups.push(buf.join(' '));
  const avail = w - 26;
  const sz = Math.max(5.5, Math.min(15, w * 0.3, avail / Math.max(...groups.map(g => g.length)) * 1.5));

  return (
    <>
      {/* Border frame */}
      <View
        style={{
          position: 'absolute',
          top: '9%' as DimensionValue,
          bottom: '9%' as DimensionValue,
          left: '10%' as DimensionValue,
          right: '10%' as DimensionValue,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: rc(isDark),
        }}
        pointerEvents="none"
      />
      <HorizontalZone zone={[0.16, 0.56]} gap={1}>
        {groups.map((g, i) => (
          <Text
            key={i}
            style={{
              fontFamily: titleFont,
              fontWeight: '700',
              fontSize: sz,
              letterSpacing: 0.5,
              color: fg(isDark),
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.3}
          >
            {titleCase(g)}
          </Text>
        ))}
      </HorizontalZone>
      {/* Short centered rule */}
      <View
        style={{
          position: 'absolute',
          left: '32%' as DimensionValue,
          right: '32%' as DimensionValue,
          top: '61%' as DimensionValue,
          height: StyleSheet.hairlineWidth,
          backgroundColor: rc(isDark),
        }}
        pointerEvents="none"
      />
      <AuthorHorizontal author={author} font={authorFont} w={w} zone={[0.65, 0.84]} isDark={isDark} />
    </>
  );
}

/**
 * 8. STACKED LETTERS — Monumental. One character per line.
 * Best for short titles.
 */
function c8({ w, h, title, author, titleFont, authorFont, isDark }: CompositionProps) {
  const chars = title.toUpperCase().split('');
  const spaceCount = chars.filter(c => c === ' ').length;
  const charCount = chars.length - spaceCount;
  const zoneH = h * 0.72;
  const charSz = Math.max(7, Math.min(w * 0.52, (zoneH - 14) / (charCount + spaceCount * 0.35) * 0.85));

  return (
    <>
      <View
        style={{
          position: 'absolute',
          top: '4%' as DimensionValue,
          left: 0,
          right: 0,
          height: '74%' as DimensionValue,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          paddingVertical: 7,
        }}
        pointerEvents="none"
      >
        {chars.map((c, i) => {
          if (c === ' ') return <View key={i} style={{ height: charSz * 0.3 }} />;
          return (
            <Text
              key={i}
              style={{
                fontFamily: titleFont,
                fontWeight: '700',
                fontSize: charSz,
                lineHeight: charSz * 1.0,
                color: fg(isDark),
                letterSpacing: 1,
              }}
            >
              {c}
            </Text>
          );
        })}
      </View>
      <AuthorVertical author={author} font={authorFont} h={h} zone={[0.82, 0.98]} rot={-90} isDark={isDark} />
    </>
  );
}

/**
 * 9. CENTERED MINIMAL — Maximum whitespace.
 * Title small and centered in the middle. Author tiny at the very bottom.
 */
function c9({ w, h, title, author, titleFont, authorFont, isDark }: CompositionProps) {
  const lines = splitTitle(title);
  const sz = calcFontSize(w, lines.length, 14, 5.5);

  return (
    <>
      <RotatedZone h={h} zone={[0.28, 0.66]} rot={-90}>
        {lines.map((l, i) => (
          <Text
            key={i}
            style={{
              fontFamily: titleFont,
              fontWeight: '700',
              fontSize: sz,
              letterSpacing: 1,
              color: fg(isDark),
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.3}
          >
            {titleCase(l)}
          </Text>
        ))}
      </RotatedZone>
      <AuthorVertical author={author} font={authorFont} h={h} zone={[0.90, 0.99]} rot={-90} isDark={isDark} />
    </>
  );
}

/**
 * 10. ASYMMETRIC — Title left-aligned, pushed up.
 * Author right-aligned, pushed down. Diagonal tension.
 * Two thin rules frame the empty center.
 */
function c10({ w, h, title, author, titleFont, authorFont, isDark }: CompositionProps) {
  const lines = splitTitle(title);
  const sz = calcFontSize(w, lines.length, 16, 5.5);

  return (
    <>
      <RotatedZone h={h} zone={[0.04, 0.48]} rot={-90} align="flex-start">
        {lines.map((l, i) => (
          <Text
            key={i}
            style={{
              fontFamily: titleFont,
              fontWeight: '700',
              fontSize: sz,
              letterSpacing: 1.2,
              color: fg(isDark),
              textTransform: 'uppercase',
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.3}
          >
            {l.toUpperCase()}
          </Text>
        ))}
      </RotatedZone>
      <HR pos={0.52} isDark={isDark} inset={22} />
      <HR pos={0.55} isDark={isDark} inset={22} />
      <AuthorVertical author={author} font={authorFont} h={h} zone={[0.78, 0.96]} rot={-90} isDark={isDark} align="flex-end" />
    </>
  );
}

/**
 * 11. EDITORIAL — Small italic author at top, large title below.
 * Like a magazine spine.
 */
function c11({ w, h, title, author, titleFont, authorFont, isDark }: CompositionProps) {
  const lines = splitTitle(title);
  const sz = calcFontSize(w, lines.length, 20, 5.5);
  const aSz = Math.max(4.5, Math.min(8, h * 0.12 * 0.15));

  return (
    <>
      <RotatedZone h={h} zone={[0.03, 0.15]} rot={-90}>
        <Text
          style={{
            fontFamily: authorFont,
            fontWeight: '400',
            fontSize: aSz,
            letterSpacing: 0.5,
            color: fg2(isDark),
            fontStyle: 'italic',
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.3}
        >
          {author}
        </Text>
      </RotatedZone>
      <RotatedZone h={h} zone={[0.20, 0.96]} rot={-90}>
        {lines.map((l, i) => (
          <Text
            key={i}
            style={{
              fontFamily: titleFont,
              fontWeight: '700',
              fontSize: sz,
              letterSpacing: 2,
              color: fg(isDark),
              textTransform: 'uppercase',
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.3}
          >
            {l.toUpperCase()}
          </Text>
        ))}
      </RotatedZone>
    </>
  );
}

// =============================================================================
// COMPOSITIONS ARRAY & SELECTOR
// =============================================================================

export const COMPOSITIONS: CompositionFn[] = [
  c0,  // classic
  c1,  // author boxed
  c2,  // horiz stacked
  c3,  // split + rule
  c4,  // author top
  c5,  // vertical down
  c6,  // extreme spread
  c7,  // bookplate
  c8,  // stacked letters
  c9,  // centered minimal
  c10, // asymmetric
  c11, // editorial
];

/**
 * Deterministically pick a composition for a book.
 * Short titles (≤2 words, ≤14 chars) have 50% chance of layouts suited for short text.
 */
export function pickComposition(bookId: string, title: string): number {
  const h = hashString(bookId + '-comp');
  const words = title.split(' ');
  const isShort = words.length <= 2 && title.length <= 14;

  if (isShort && hashToBool(bookId + '-sh', 50)) {
    return hashToPick(bookId + '-sc', [2, 7, 8]);
  }

  return h % COMPOSITIONS.length;
}
