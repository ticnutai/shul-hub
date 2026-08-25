import { PlusCircle } from "lucide-react";
import { useTextDisplayStyles } from "@/hooks/useTextDisplayStyles";
import { Button } from "./ui/button";

interface AddContentButtonProps {
  type: "title" | "question" | "answer";
  onClick: (e?: React.MouseEvent) => void;
  className?: string;
}

export const AddContentButton = ({ type, onClick, className = "" }: AddContentButtonProps) => {
  const { isMobile } = useTextDisplayStyles();
  
  const tooltips = {
    title: "הוסף כותרת חדשה",
    question: "הוסף שאלה",
    answer: "הוסף תשובה"
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={(e) => {
        e.stopPropagation(); // מונע מהקליק להעביר לפסוק הראשי
        onClick(e);
      }}
      className={`
        h-6 w-6 p-0 shrink-0
        ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} 
        transition-opacity duration-200
        bg-background/80 hover:bg-primary/20
        border border-border
        rounded-full
        ${className}
      `}
      title={tooltips[type]}
      aria-label={tooltips[type]}
    >
      <PlusCircle className="h-4 w-4 text-primary" />
    </Button>
  );
};
