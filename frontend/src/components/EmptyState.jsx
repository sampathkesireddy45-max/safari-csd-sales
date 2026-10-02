import React from "react";
import { PackageOpen, CameraOff, AlertCircle, Inbox, Users, MapPin } from "lucide-react";

const icons = {
  damages: AlertCircle,
  photos: CameraOff,
  sales: PackageOpen,
  employees: Users,
  locations: MapPin,
  default: Inbox,
};

const EmptyState = ({
  type = "default",
  title = "No records found",
  description = "No actual database records are available yet.",
  actionLabel,
  onAction,
}) => {
  const IconComponent = icons[type] || icons.default;

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm transition-all">
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 mb-4 shadow-inner">
        <IconComponent className="w-10 h-10 text-slate-400/80 stroke-[1.5]" />
      </div>
      <h3 className="text-base font-semibold text-slate-800 mb-1">
        {title}
      </h3>
      <p className="text-sm text-slate-500 max-w-sm mb-5">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition shadow-sm hover:shadow"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
