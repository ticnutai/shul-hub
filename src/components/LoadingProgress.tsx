import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Circle, X } from "lucide-react";

interface LoadingProgressProps {
  books: Array<{
    name: string;
    status: 'pending' | 'loading' | 'completed' | 'error';
    progress: number;
  }>;
  onCancel?: () => void;
}

export const LoadingProgress = ({ books, onCancel }: LoadingProgressProps) => {
  const totalProgress = books.reduce((sum, book) => sum + book.progress, 0) / books.length;
  const completedCount = books.filter(b => b.status === 'completed').length;

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">טוען נתונים...</CardTitle>
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{completedCount}/{books.length} ספרים</span>
              <span>{Math.round(totalProgress)}%</span>
            </div>
            <Progress value={totalProgress} className="h-2" />
          </div>

          <div className="space-y-3">
            {books.map((book, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
              >
                <div className="flex-shrink-0">
                  {book.status === 'completed' && (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                  {book.status === 'loading' && (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  )}
                  {book.status === 'pending' && (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                  {book.status === 'error' && (
                    <X className="h-5 w-5 text-destructive" />
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{book.name}</span>
                    {book.status === 'loading' && (
                      <span className="text-xs text-muted-foreground">
                        {Math.round(book.progress)}%
                      </span>
                    )}
                  </div>
                  {book.status === 'loading' && (
                    <Progress value={book.progress} className="h-1" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {completedCount > 0 && completedCount < books.length && (
            <div className="text-sm text-center text-muted-foreground pt-2">
              ניתן להתחיל לחפש בספרים שנטענו
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
