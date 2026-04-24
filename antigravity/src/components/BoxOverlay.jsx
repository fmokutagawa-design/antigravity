import React, { useLayoutEffect, useRef, useState } from 'react';

/**
 * BoxOverlay component:
 * Safely renders a selection box by reading the parent's scroll position via ref
 * inside a layout effect, preventing "accessing ref during render" warnings.
 * Uses direct DOM manipulation for performance to avoid re-renders on scroll.
 */
const BoxOverlay = ({ active, start, end, textareaRef }) => {
    const overlayRef = useRef(null);

    useLayoutEffect(() => {
        const el = overlayRef.current;
        if (!el) return;

        if (!active || !start || !end || !textareaRef.current) {
            el.style.display = 'none';
            return;
        }

        const updatePosition = () => {
            const ta = textareaRef.current;
            if (!ta) {
                el.style.display = 'none';
                return;
            }

            const minX = Math.min(start.visualX, end.visualX);
            const minY = Math.min(start.visualY, end.visualY);
            const w = Math.abs(end.visualX - start.visualX);
            const h = Math.abs(end.visualY - start.visualY);

            const scrollTop = ta.scrollTop;
            const scrollLeft = ta.scrollLeft;

            el.style.display = 'block';
            el.style.position = 'absolute';
            el.style.zIndex = '20';
            el.style.pointerEvents = 'none';
            el.style.background = 'rgba(0, 120, 215, 0.3)';
            el.style.border = '1px solid rgba(0, 120, 215, 0.8)';
            el.style.left = `${minX - scrollLeft + 30}px`;
            el.style.top = `${minY - scrollTop + 30}px`;
            el.style.width = `${w}px`;
            el.style.height = `${h}px`;
        };

        // Update initially
        updatePosition();

        const ta = textareaRef.current;
        const handleScroll = () => {
            updatePosition();
        };

        ta.addEventListener('scroll', handleScroll);
        return () => ta.removeEventListener('scroll', handleScroll);

    }, [active, start, end, textareaRef]);

    return <div ref={overlayRef} style={{ display: 'none' }} />;
};

export default BoxOverlay;
