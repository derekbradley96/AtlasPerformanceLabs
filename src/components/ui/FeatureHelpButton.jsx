import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { usePresentationMode } from '@/lib/presentationMode';
import { colors } from '@/ui/tokens';
import { impactLight } from '@/lib/haptics';
import { getFeatureHelp } from '@/lib/featureHelp';

/**
 * "Learn more" affordance for coach creation screens (AJB tester feedback #7).
 * Renders a 44px help icon (for TopBar rightAction / shell setHeaderRight) or a
 * text link, opening a sheet with the feature explanation from featureHelp.js.
 * Renders nothing when the feature has no copy — safe to leave in place.
 *
 * @param {{ feature: string, variant?: 'icon' | 'link' }} props
 */
export default function FeatureHelpButton({ feature, variant = 'icon' }) {
  const [open, setOpen] = useState(false);
  const { isDesktopWeb } = usePresentationMode();
  const help = getFeatureHelp(feature);
  if (!help) return null;

  const openSheet = () => {
    impactLight();
    setOpen(true);
  };

  const body = (
    <div className="space-y-3" style={{ padding: isDesktopWeb ? 0 : '0 16px 24px' }}>
      {help.paragraphs.map((text, i) => (
        <p key={i} className="text-sm leading-relaxed" style={{ color: colors.muted }}>{text}</p>
      ))}
    </div>
  );

  return (
    <>
      {variant === 'link' ? (
        <button
          type="button"
          onClick={openSheet}
          className="inline-flex items-center gap-1 text-xs font-semibold"
          style={{ color: colors.primary, background: 'transparent', border: 'none', padding: 0 }}
        >
          <HelpCircle size={14} aria-hidden />
          Learn more
        </button>
      ) : (
        <button
          type="button"
          onClick={openSheet}
          className="flex items-center justify-center rounded-lg active:opacity-80"
          style={{ minWidth: 44, minHeight: 44, color: colors.muted, background: 'transparent', border: 'none' }}
          aria-label={`Learn more about ${help.title.toLowerCase()}`}
        >
          <HelpCircle size={21} strokeWidth={2.25} aria-hidden />
        </button>
      )}
      {isDesktopWeb ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{help.title}</DialogTitle>
            </DialogHeader>
            {body}
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{help.title}</DrawerTitle>
            </DrawerHeader>
            {body}
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}
