import { useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Share2, Copy, Link2, MessageCircle, Facebook, Twitter, Instagram, Share } from "lucide-react";
import { toast } from "sonner";
import { shareLinks, withUtm, type ShareSource, type ShareChannel } from "@/lib/share";

type Props = {
  url: string;
  title: string;
  text?: string;
  source: ShareSource;
  /** Render inline (all buttons visible in a row) instead of a popover trigger. */
  inline?: boolean;
  trigger?: ReactNode;
  className?: string;
};

export function ShareMenu({ url, title, text, source, inline, trigger, className }: Props) {
  const [open, setOpen] = useState(false);
  const links = shareLinks({ url, title, text, source });
  const hasNative = typeof navigator !== "undefined" && "share" in navigator;

  const openChannel = (channel: ShareChannel, href: string) => {
    void channel;
    window.open(href, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(withUtm(url, "copy", source));
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
    setOpen(false);
  };

  const instagram = async () => {
    // Instagram has no public web share intent. Copy the link and prompt the user.
    try {
      await navigator.clipboard.writeText(withUtm(url, "instagram", source));
      toast.success("Link copied — paste it in your Instagram story or bio");
    } catch {
      toast.error("Couldn't copy link");
    }
    setOpen(false);
  };

  const native = async () => {
    try {
      await navigator.share({ title, text: text ?? title, url: withUtm(url, "native", source) });
    } catch {
      /* user dismissed */
    }
    setOpen(false);
  };

  const buttons = (
    <div className="grid grid-cols-4 gap-2">
      <ChannelButton icon={<MessageCircle className="size-5" />} label="WhatsApp" onClick={() => openChannel("whatsapp", links.whatsapp)} tint="bg-[#25D366]/10 text-[#128C7E]" />
      <ChannelButton icon={<Facebook className="size-5" />} label="Facebook" onClick={() => openChannel("facebook", links.facebook)} tint="bg-[#1877F2]/10 text-[#1877F2]" />
      <ChannelButton icon={<Instagram className="size-5" />} label="Instagram" onClick={instagram} tint="bg-gradient-to-br from-[#F58529]/15 to-[#DD2A7B]/15 text-[#C13584]" />
      <ChannelButton icon={<Twitter className="size-5" />} label="X" onClick={() => openChannel("x", links.x)} tint="bg-navy/5 text-navy" />
      <ChannelButton icon={<Link2 className="size-5" />} label="Copy" onClick={copy} tint="bg-sand text-navy/70" />
      {hasNative && (
        <ChannelButton icon={<Share className="size-5" />} label="More" onClick={native} tint="bg-sand text-navy/70" />
      )}
    </div>
  );

  if (inline) {
    return (
      <div className={className}>
        {buttons}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <button
            className="bg-white ring-1 ring-hairline text-navy p-3 rounded-2xl inline-flex items-center justify-center"
            aria-label="Share"
          >
            <Share2 className="size-4" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="text-[11px] uppercase tracking-wider font-medium text-navy/50 mb-2 px-1">Share</div>
        {buttons}
      </PopoverContent>
    </Popover>
  );
}

function ChannelButton({ icon, label, onClick, tint }: { icon: ReactNode; label: string; onClick: () => void; tint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-xl p-2.5 hover:bg-sand transition-colors"
    >
      <span className={`grid place-items-center size-10 rounded-full ${tint}`}>{icon}</span>
      <span className="text-[10px] font-medium text-navy/70">{label}</span>
    </button>
  );
}

/** Convenience — pre-configured share icon button (used to swap the plain Share2 button). */
export function ShareIconButton(props: Props) {
  return <ShareMenu {...props} />;
}
