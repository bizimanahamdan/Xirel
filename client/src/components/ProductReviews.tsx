import { useState, useEffect } from "react";
import { Star, ShieldCheck, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Link } from "wouter";

function StarRow({
  rating,
  size = "w-4 h-4",
  interactive,
  onChange,
}: {
  rating: number;
  size?: string;
  interactive?: boolean;
  onChange?: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(n)}
          className={interactive ? "cursor-pointer" : "cursor-default"}
        >
          <Star
            className={`${size} ${
              n <= Math.round(rating) ? "fill-accent-rose text-accent-rose" : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export function ProductReviews({ productId }: { productId: number }) {
  const { isAuthenticated, user } = useAuth();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.reviews.list.useQuery({ productId });
  const { data: myReview } = trpc.reviews.myReview.useQuery(
    { productId },
    { enabled: isAuthenticated }
  );

  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (myReview) {
      setRating(myReview.rating);
      setTitle(myReview.title ?? "");
      setComment(myReview.comment ?? "");
    }
  }, [myReview]);

  const submitMutation = trpc.reviews.submit.useMutation({
    onSuccess: () => {
      toast.success(myReview ? "Review updated" : "Thanks for your review!");
      setShowForm(false);
      utils.reviews.list.invalidate({ productId });
      utils.reviews.myReview.invalidate({ productId });
    },
    onError: (error) => {
      toast.error("Couldn't submit review", { description: error.message });
    },
  });

  const deleteMutation = trpc.reviews.delete.useMutation({
    onSuccess: () => {
      toast.success("Review removed");
      utils.reviews.list.invalidate({ productId });
      utils.reviews.myReview.invalidate({ productId });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error("Please select a star rating");
      return;
    }
    submitMutation.mutate({ productId, rating, title: title || undefined, comment: comment || undefined });
  };

  const stats = data?.stats;

  return (
    <div className="mt-16 pt-12 border-t border-border">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold mb-2">Reviews</h2>
          {stats && stats.count > 0 ? (
            <div className="flex items-center gap-3">
              <StarRow rating={stats.average} />
              <span className="font-semibold">{stats.average.toFixed(1)}</span>
              <span className="text-muted-foreground text-sm">
                ({stats.count} review{stats.count !== 1 ? "s" : ""})
              </span>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No reviews yet — be the first.</p>
          )}
        </div>

        {isAuthenticated ? (
          <Button variant="outline" onClick={() => setShowForm(!showForm)}>
            {myReview ? "Edit Your Review" : "Write a Review"}
          </Button>
        ) : (
          <Link href="/login">
            <span className="text-sm text-accent-rose hover:underline cursor-pointer">
              Sign in to leave a review
            </span>
          </Link>
        )}
      </div>

      {showForm && (
        <Card className="p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Your rating</label>
              <StarRow rating={rating} size="w-7 h-7" interactive onChange={setRating} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Title (optional)</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sum it up" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Your review (optional)</label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What did you think?"
                rows={4}
              />
            </div>
            <Button type="submit" disabled={submitMutation.isPending}>
              {submitMutation.isPending ? "Submitting..." : myReview ? "Update Review" : "Submit Review"}
            </Button>
          </form>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading reviews...</p>
      ) : (
        <div className="space-y-6">
          {data?.items.map((review) => (
            <div key={review.id} className="border-b border-border pb-6 last:border-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <StarRow rating={review.rating} />
                    {review.verified && (
                      <span className="inline-flex items-center gap-1 text-xs text-accent-sage font-medium">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Verified Purchase
                      </span>
                    )}
                  </div>
                  {review.title && <p className="font-semibold">{review.title}</p>}
                </div>
                {(user?.id === review.userId || user?.role === "admin") && (
                  <button
                    onClick={() => deleteMutation.mutate({ id: review.id })}
                    className="text-muted-foreground hover:text-destructive"
                    title="Delete review"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {review.comment && <p className="text-muted-foreground mt-2">{review.comment}</p>}
              <p className="text-xs text-muted-foreground mt-2">
                {review.reviewerName} · {new Date(review.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
