import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-by-surface-raised group-[.toaster]:text-by-text-primary group-[.toaster]:border-by-border-engraved group-[.toaster]:shadow-by-float",
          description: "group-[.toast]:text-by-text-secondary",
          actionButton:
            "group-[.toast]:bg-by-surface-control-dark group-[.toast]:text-by-text-on-control",
          cancelButton: "group-[.toast]:bg-by-surface-muted group-[.toast]:text-by-text-secondary",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
