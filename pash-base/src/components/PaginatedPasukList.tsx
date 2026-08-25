import { useState, useEffect } from "react";
import { FlatPasuk } from "@/types/torah";
import { PasukDisplay } from "@/components/PasukDisplay";
import { useDisplayMode } from "@/contexts/DisplayModeContext";
import { toHebrewNumber } from "@/utils/hebrewNumbers";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginatedPasukListProps {
  pesukim: FlatPasuk[];
  seferId: number;
  expandAll?: boolean;
}

export const PaginatedPasukList = ({ pesukim, seferId, expandAll = false }: PaginatedPasukListProps) => {
  const { displaySettings } = useDisplayMode();
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = displaySettings?.pasukCount || 20;
  const totalPages = Math.ceil(pesukim.length / itemsPerPage);
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayedPesukim = pesukim.slice(startIndex, endIndex);

  // Reset to first page when pesukim change
  useEffect(() => {
    setCurrentPage(1);
  }, [pesukim, itemsPerPage]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && currentPage < totalPages) {
        // Left arrow = next page (forward in Hebrew)
        setCurrentPage((prev) => prev + 1);
      } else if (e.key === "ArrowRight" && currentPage > 1) {
        // Right arrow = previous page (backward in Hebrew)
        setCurrentPage((prev) => prev - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, totalPages]);

  const handlePageClick = (page: number) => {
    setCurrentPage(page);
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      handlePageClick(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      handlePageClick(currentPage + 1);
    }
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const showEllipsis = totalPages > 7;

    if (!showEllipsis) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push("ellipsis");
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push("ellipsis");
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  if (pesukim.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Pesukim Display */}
      <div className="space-y-4">
        {displayedPesukim.map((pasuk) => (
          <PasukDisplay key={pasuk.id} pasuk={pasuk} seferId={seferId} forceMinimized={!expandAll} />
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <Pagination className="my-8">
          <PaginationContent className="gap-2">
            {/* Previous Button (Backward in Hebrew) */}
            <PaginationItem>
              <button
                onClick={handlePrevious}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-background border hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="עמוד קודם"
              >
                <ChevronRight className="h-4 w-4" />
                <span className="text-sm">קודם</span>
              </button>
            </PaginationItem>

            {/* Page Numbers */}
            {getPageNumbers().map((page, index) => (
              <PaginationItem key={index}>
                {page === "ellipsis" ? (
                  <PaginationEllipsis />
                ) : (
                  <button
                    onClick={() => handlePageClick(page)}
                    className={`inline-flex items-center justify-center w-10 h-10 rounded-md font-semibold transition-colors ${
                      currentPage === page
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-background border hover:bg-accent hover:text-accent-foreground"
                    }`}
                    aria-label={`עמוד ${toHebrewNumber(page)}`}
                    aria-current={currentPage === page ? "page" : undefined}
                  >
                    {toHebrewNumber(page)}
                  </button>
                )}
              </PaginationItem>
            ))}

            {/* Next Button (Forward in Hebrew) */}
            <PaginationItem>
              <button
                onClick={handleNext}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-background border hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="עמוד הבא"
              >
                <span className="text-sm">הבא</span>
                <ChevronLeft className="h-4 w-4" />
              </button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Page Info */}
      {totalPages > 1 && (
        <div className="text-center text-sm text-muted-foreground py-4">
          עמוד {toHebrewNumber(currentPage)} מתוך {toHebrewNumber(totalPages)} ({toHebrewNumber(pesukim.length)} פסוקים סה"כ)
        </div>
      )}
    </div>
  );
};
