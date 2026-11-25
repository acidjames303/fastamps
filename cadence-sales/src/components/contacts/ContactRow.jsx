import React, { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Trash2, ChevronRight, Phone, Pencil } from "lucide-react";
import { Link } from "react-router-dom";

const statusStyles = {
  good: "bg-emerald-50 text-emerald-700 border-emerald-200",
  bad: "bg-rose-50 text-rose-700 border-rose-200",
  wrong_person: "bg-amber-50 text-amber-700 border-amber-200",
  dnc: "bg-slate-200 text-slate-700 border-slate-300",
  untested: "bg-slate-50 text-slate-500 border-slate-200",
};

export default function ContactRow({ contact, selected, onSelect, onClick, onEdit, onDeleteRequest, isAdmin, campaignId }) {
  const [swipeX, setSwipeX] = useState(0);
  const touchStart = useRef(null);

  const onTouchStart = (e) => {
    touchStart.current = e.touches[0].clientX;
  };
  const onTouchMove = (e) => {
    if (touchStart.current === null) return;
    const delta = e.touches[0].clientX - touchStart.current;
    if (delta < 0) setSwipeX(Math.max(delta, -80));
  };
  const onTouchEnd = () => {
    if (swipeX < -40) setSwipeX(-80);
    else setSwipeX(0);
    touchStart.current = null;
  };

  return (
    <div className="relative overflow-hidden border-b border-slate-100 group">
      {/* Delete action behind the row — swipe only (mobile) */}
      {isAdmin && (
        <button
          onClick={(e) => { e.stopPropagation(); setSwipeX(0); onDeleteRequest?.(contact); }}
          className="absolute right-0 top-0 bottom-0 z-0 flex items-center justify-center bg-rose-500 text-white px-5 md:hidden"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}

      {/* Main row content */}
      <div
        className={`relative z-10 flex items-center bg-white transition-transform ${onClick ? "cursor-pointer hover:bg-slate-50" : ""}`}
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => onClick?.(contact)}
      >
        {/* Selection checkbox */}
        {onSelect && (
          <input
            type="checkbox"
            checked={selected || false}
            onChange={(e) => { e.stopPropagation(); onSelect(contact.id, e.target.checked); }}
            onClick={(e) => e.stopPropagation()}
            className="ml-4 md:ml-5 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400 flex-shrink-0"
          />
        )}

        {/* Grid content */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center px-3 md:px-4 py-4 text-sm flex-1 min-w-0">
          <div className="min-w-0">
            <p className="font-medium text-slate-900 truncate">{contact.full_name}</p>
            <p className="text-slate-500 text-xs truncate">{contact.job_title}</p>
          </div>
          <div className="text-slate-700 truncate hidden md:block">{contact.company}</div>
          <div className="text-slate-500 hidden md:block truncate">{contact.industry || "—"}</div>
          <div className="text-slate-500 hidden md:block truncate">{contact.cluster || "unclustered"}</div>
          <div className="text-slate-500 hidden md:block truncate">{contact.profile_type || "—"}</div>
          <div className="flex items-center gap-2 justify-end">
            <Badge variant="outline" className={statusStyles[contact.number_status] || statusStyles.untested}>
              {contact.number_status === "bad" && <AlertTriangle className="w-3 h-3 mr-1" />}
              {(contact.number_status || "untested").replace("_", " ")}
            </Badge>
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(contact); }}
                className="hidden md:flex items-center justify-center w-7 h-7 rounded-full text-slate-300 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
                title="Edit contact"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <Link
              to={`/dialer?contact=${contact.id}${campaignId ? `&list=${campaignId}` : ""}${contact.company_id ? `&company=${contact.company_id}` : ""}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center w-7 h-7 rounded-full text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors flex-shrink-0"
              title="Open in dialer"
            >
              <Phone className="w-3.5 h-3.5" />
            </Link>
            {isAdmin && (
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteRequest?.(contact); }}
                className="hidden md:flex items-center justify-center w-7 h-7 rounded-full text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                title="Delete contact"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <ChevronRight className="w-4 h-4 text-slate-300 md:hidden flex-shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
}