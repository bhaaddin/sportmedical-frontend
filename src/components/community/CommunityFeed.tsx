import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Avatar, Button, TextField, Card, CardContent, CardActions } from '@mui/material';
import { Favorite, FavoriteBorder, Comment, Share, Add } from '@mui/icons-material';
import { motion } from 'framer-motion';

interface Post {
  id: string;
  author: { name: string; avatar: string };
  content: string;
  image?: string;
  likes: number;
  comments: number;
  isLiked: boolean;
  createdAt: string;
}

export default function CommunityFeed({ customerId }: { customerId: string }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/community/posts')
      .then(r => r.ok ? r.json() : [])
      .then(data => setPosts(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLike = async (postId: string) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 } : p));
    try { await fetch(`/api/community/posts/${postId}/like`, { method: 'POST' }); } catch {}
  };

  const handleNewPost = async () => {
    if (!newPost.trim()) return;
    try {
      const response = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newPost, customerId }),
      });
      if (response.ok) { setNewPost(''); }
    } catch {}
  };

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main' }}>VY</Avatar>
          <TextField fullWidth multiline rows={2} placeholder="Napište příspěvek..." value={newPost} onChange={(e) => setNewPost(e.target.value)} />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button variant="contained" startIcon={<Add />} onClick={handleNewPost} disabled={!newPost.trim()}>Publikovat</Button>
        </Box>
      </Paper>

      {posts.map((post, index) => (
        <motion.div key={post.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.1 }}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Avatar src={post.author.avatar}>{post.author.name[0]}</Avatar>
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>{post.author.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{new Date(post.createdAt).toLocaleDateString('cs-CZ')}</Typography>
                </Box>
              </Box>
              <Typography variant="body1" sx={{ mb: 2 }}>{post.content}</Typography>
              {post.image && <Box component="img" src={post.image} sx={{ width: '100%', borderRadius: 1, mb: 2 }} />}
            </CardContent>
            <CardActions sx={{ px: 2, pb: 2 }}>
              <Button size="small" startIcon={post.isLiked ? <Favorite color="error" /> : <FavoriteBorder />} onClick={() => handleLike(post.id)}>{post.likes}</Button>
              <Button size="small" startIcon={<Comment />}>{post.comments}</Button>
              <Button size="small" startIcon={<Share />}>Sdílet</Button>
            </CardActions>
          </Card>
        </motion.div>
      ))}
    </Box>
  );
}
