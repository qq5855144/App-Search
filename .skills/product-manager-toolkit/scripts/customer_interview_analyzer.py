#!/usr/bin/env python3
"""
客户访谈分析器
从用户访谈中提取洞察、模式和机会
"""

import re
from typing import Dict, List, Tuple, Set
from collections import Counter, defaultdict
import json

class InterviewAnalyzer:
    """分析客户访谈的洞察和模式"""
    
    def __init__(self):
        # 痛点指示词
        self.pain_indicators = [
            'frustrat', 'annoy', 'difficult', 'hard', 'confus', 'slow',
            'problem', 'issue', 'struggle', 'challeng', 'pain', 'waste',
            'manual', 'repetitive', 'tedious', 'boring', 'time-consuming',
            'complicated', 'complex', 'unclear', 'wish', 'need', 'want',
            '头疼', '麻烦', '困难', '复杂', '慢', '问题', '痛点', '浪费',
            '手动', '重复', '繁琐', '混乱', '不清楚', '希望', '需要'
        ]
        
        # 积极指示词
        self.delight_indicators = [
            'love', 'great', 'awesome', 'amazing', 'perfect', 'easy',
            'simple', 'quick', 'fast', 'helpful', 'useful', 'valuable',
            'save', 'efficient', 'convenient', 'intuitive', 'clear',
            '喜欢', '好', '棒', '完美', '简单', '快', '方便', '直观', '清晰'
        ]
        
        # 功能请求指示词
        self.request_indicators = [
            'would be nice', 'wish', 'hope', 'want', 'need', 'should',
            'could', 'would love', 'if only', 'it would help', 'suggest',
            'recommend', 'idea', 'what if', 'have you considered',
            '如果能', '希望有', '想要', '建议', '要是', '最好'
        ]
        
        # 待办任务模式
        self.jtbd_patterns = [
            r'when i\s+(.+?),\s+i want to\s+(.+?)\s+so that\s+(.+)',
            r'i need to\s+(.+?)\s+because\s+(.+)',
            r'my goal is to\s+(.+)',
            r'i\'m trying to\s+(.+)',
            r'i use \w+ to\s+(.+)',
            r'helps me\s+(.+)',
            r'当我\s+(.+?)\s+时?，?我?想?要?\s+(.+?)\s+以便\s+(.+)',
            r'我需要\s+(.+?)\s+因为\s+(.+)',
        ]
    
    def analyze_interview(self, text: str) -> Dict:
        """分析单篇访谈记录"""
        text_lower = text.lower()
        sentences = self._split_sentences(text)
        
        analysis = {
            'pain_points': self._extract_pain_points(sentences),
            'delights': self._extract_delights(sentences),
            'feature_requests': self._extract_requests(sentences),
            'jobs_to_be_done': self._extract_jtbd(text_lower),
            'sentiment_score': self._calculate_sentiment(text_lower),
            'key_themes': self._extract_themes(text_lower),
            'quotes': self._extract_key_quotes(sentences),
            'metrics_mentioned': self._extract_metrics(text),
            'competitors_mentioned': self._extract_competitors(text)
        }
        
        return analysis
    
    def _split_sentences(self, text: str) -> List[str]:
        """将文本分割为句子"""
        sentences = re.split(r'[.!?。！？]+', text)
        return [s.strip() for s in sentences if s.strip()]
    
    def _extract_pain_points(self, sentences: List[str]) -> List[Dict]:
        """从句子中提取痛点"""
        pain_points = []
        
        for sentence in sentences:
            sentence_lower = sentence.lower()
            for indicator in self.pain_indicators:
                if indicator in sentence_lower:
                    pain_points.append({
                        'quote': sentence,
                        'indicator': indicator,
                        'severity': self._assess_severity(sentence_lower)
                    })
                    break
        
        return pain_points[:10]
    
    def _extract_delights(self, sentences: List[str]) -> List[Dict]:
        """提取正面反馈"""
        delights = []
        
        for sentence in sentences:
            sentence_lower = sentence.lower()
            for indicator in self.delight_indicators:
                if indicator in sentence_lower:
                    delights.append({
                        'quote': sentence,
                        'indicator': indicator,
                        'strength': self._assess_strength(sentence_lower)
                    })
                    break
        
        return delights[:10]
    
    def _extract_requests(self, sentences: List[str]) -> List[Dict]:
        """提取功能请求和建议"""
        requests = []
        
        for sentence in sentences:
            sentence_lower = sentence.lower()
            for indicator in self.request_indicators:
                if indicator in sentence_lower:
                    requests.append({
                        'quote': sentence,
                        'type': self._classify_request(sentence_lower),
                        'priority': self._assess_request_priority(sentence_lower)
                    })
                    break
        
        return requests[:10]
    
    def _extract_jtbd(self, text: str) -> List[Dict]:
        """提取待办任务模式"""
        jobs = []
        
        for pattern in self.jtbd_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                if isinstance(match, tuple):
                    job = ' → '.join(match)
                else:
                    job = match
                
                jobs.append({
                    'job': job,
                    'pattern': pattern.pattern if hasattr(pattern, 'pattern') else pattern
                })
        
        return jobs[:5]
    
    def _calculate_sentiment(self, text: str) -> Dict:
        """计算访谈的整体情感"""
        positive_count = sum(1 for ind in self.delight_indicators if ind in text)
        negative_count = sum(1 for ind in self.pain_indicators if ind in text)
        
        total = positive_count + negative_count
        if total == 0:
            sentiment_score = 0
        else:
            sentiment_score = (positive_count - negative_count) / total
        
        if sentiment_score > 0.3:
            sentiment_label = 'positive'
        elif sentiment_score < -0.3:
            sentiment_label = 'negative'
        else:
            sentiment_label = 'neutral'
        
        return {
            'score': round(sentiment_score, 2),
            'label': sentiment_label,
            'positive_signals': positive_count,
            'negative_signals': negative_count
        }
    
    def _extract_themes(self, text: str) -> List[str]:
        """使用词频提取关键主题"""
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at',
                     'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is',
                     'was', 'are', 'were', 'been', 'be', 'have', 'has',
                     'had', 'do', 'does', 'did', 'will', 'would', 'could',
                     'should', 'may', 'might', 'must', 'can', 'shall',
                     'it', 'i', 'you', 'we', 'they', 'them', 'their',
                     '的', '了', '是', '在', '我', '有', '和', '就', '不', '人',
                     '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去'}
        
        words = re.findall(r'\b[a-z]{4,}\b', text)
        meaningful_words = [w for w in words if w not in stop_words]
        
        word_freq = Counter(meaningful_words)
        themes = [word for word, count in word_freq.most_common(10) if count >= 3]
        
        return themes
    
    def _extract_key_quotes(self, sentences: List[str]) -> List[str]:
        """提取最有洞察力的引用"""
        scored_sentences = []
        
        for sentence in sentences:
            if len(sentence) < 20 or len(sentence) > 200:
                continue
            
            score = 0
            sentence_lower = sentence.lower()
            
            if any(ind in sentence_lower for ind in self.pain_indicators):
                score += 2
            if any(ind in sentence_lower for ind in self.request_indicators):
                score += 2
            if 'because' in sentence_lower or '因为' in sentence_lower:
                score += 1
            if 'but' in sentence_lower or '但是' in sentence_lower:
                score += 1
            if '?' in sentence or '？' in sentence:
                score += 1
            
            if score > 0:
                scored_sentences.append((score, sentence))
        
        scored_sentences.sort(reverse=True)
        return [s[1] for s in scored_sentences[:5]]
    
    def _extract_metrics(self, text: str) -> List[str]:
        """提取提及的指标或数字"""
        metrics = []
        
        percentages = re.findall(r'\d+%', text)
        metrics.extend(percentages)
        
        time_metrics = re.findall(r'\d+\s*(?:hours?|minutes?|days?|weeks?|months?|小时|分钟|天|周|月)', text, re.IGNORECASE)
        metrics.extend(time_metrics)
        
        money_metrics = re.findall(r'\$[\d,]+|\d+\s*元', text)
        metrics.extend(money_metrics)
        
        number_contexts = re.findall(r'(\d+)\s+(\w+)', text)
        for num, context in number_contexts:
            if context.lower() not in ['the', 'a', 'an', 'and', 'or', 'of']:
                metrics.append(f"{num} {context}")
        
        return list(set(metrics))[:10]
    
    def _extract_competitors(self, text: str) -> List[str]:
        """提取竞争对手提及"""
        competitor_patterns = [
            r'(?:use|used|using|tried|trying|switch from|switched from|instead of)\s+(\w+)',
            r'(\w+)\s+(?:is better|works better|is easier)',
            r'compared to\s+(\w+)',
            r'like\s+(\w+)',
            r'similar to\s+(\w+)',
            r'(?:用|用过|使用|试过|转向|对比|像)\s+(\w+)',
        ]
        
        competitors = set()
        for pattern in competitor_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            competitors.update(matches)
        
        common_words = {'this', 'that', 'it', 'them', 'other', 'another', 'something', '这个', '那个'}
        competitors = [c for c in competitors if c.lower() not in common_words and len(c) > 2]
        
        return list(competitors)[:5]
    
    def _assess_severity(self, text: str) -> str:
        """评估痛点严重程度"""
        if any(word in text for word in ['very', 'extremely', 'really', 'totally', 'completely', '非常', '极其', '太']):
            return 'high'
        elif any(word in text for word in ['somewhat', 'bit', 'little', 'slightly', '有点', '稍微']):
            return 'low'
        return 'medium'
    
    def _assess_strength(self, text: str) -> str:
        """评估正面反馈强度"""
        if any(word in text for word in ['absolutely', 'definitely', 'really', 'very', '绝对', '非常', '确实']):
            return 'strong'
        return 'moderate'
    
    def _classify_request(self, text: str) -> str:
        """分类请求类型"""
        if any(word in text for word in ['ui', 'design', 'look', 'color', 'layout', '界面', '设计', '样式']):
            return 'ui_improvement'
        elif any(word in text for word in ['feature', 'add', 'new', 'build', '功能', '新增', '增加']):
            return 'new_feature'
        elif any(word in text for word in ['fix', 'bug', 'broken', 'work', '修复', 'bug', '坏了']):
            return 'bug_fix'
        elif any(word in text for word in ['faster', 'slow', 'performance', 'speed', '快', '慢', '性能']):
            return 'performance'
        return 'general'
    
    def _assess_request_priority(self, text: str) -> str:
        """评估请求优先级"""
        if any(word in text for word in ['critical', 'urgent', 'asap', 'immediately', 'blocking', '紧急', '关键', '立即']):
            return 'critical'
        elif any(word in text for word in ['need', 'important', 'should', 'must', '需要', '重要', '应该']):
            return 'high'
        elif any(word in text for word in ['nice', 'would', 'could', 'maybe', '好', '可以', '也许']):
            return 'low'
        return 'medium'

def aggregate_interviews(interviews: List[Dict]) -> Dict:
    """聚合多篇访谈的洞察"""
    aggregated = {
        'total_interviews': len(interviews),
        'common_pain_points': defaultdict(list),
        'common_requests': defaultdict(list),
        'jobs_to_be_done': [],
        'overall_sentiment': {
            'positive': 0,
            'negative': 0,
            'neutral': 0
        },
        'top_themes': Counter(),
        'metrics_summary': set(),
        'competitors_mentioned': Counter()
    }
    
    for interview in interviews:
        for pain in interview.get('pain_points', []):
            indicator = pain.get('indicator', 'unknown')
            aggregated['common_pain_points'][indicator].append(pain['quote'])
        
        for request in interview.get('feature_requests', []):
            req_type = request.get('type', 'general')
            aggregated['common_requests'][req_type].append(request['quote'])
        
        aggregated['jobs_to_be_done'].extend(interview.get('jobs_to_be_done', []))
        
        sentiment = interview.get('sentiment_score', {}).get('label', 'neutral')
        aggregated['overall_sentiment'][sentiment] += 1
        
        for theme in interview.get('key_themes', []):
            aggregated['top_themes'][theme] += 1
        
        aggregated['metrics_summary'].update(interview.get('metrics_mentioned', []))
        
        for competitor in interview.get('competitors_mentioned', []):
            aggregated['competitors_mentioned'][competitor] += 1
    
    aggregated['common_pain_points'] = dict(aggregated['common_pain_points'])
    aggregated['common_requests'] = dict(aggregated['common_requests'])
    aggregated['top_themes'] = dict(aggregated['top_themes'].most_common(10))
    aggregated['metrics_summary'] = list(aggregated['metrics_summary'])
    aggregated['competitors_mentioned'] = dict(aggregated['competitors_mentioned'])
    
    return aggregated

def format_single_interview(analysis: Dict) -> str:
    """格式化单篇访谈分析"""
    output = ["=" * 60]
    output.append("客户访谈分析结果")
    output.append("=" * 60)
    
    # 情感
    sentiment = analysis['sentiment_score']
    output.append(f"\n📊 整体情感: {sentiment['label'].upper()}")
    output.append(f"   分数: {sentiment['score']}")
    output.append(f"   积极信号: {sentiment['positive_signals']}")
    output.append(f"   消极信号: {sentiment['negative_signals']}")
    
    # 痛点
    if analysis['pain_points']:
        output.append("\n🔥 识别的痛点:")
        for i, pain in enumerate(analysis['pain_points'][:5], 1):
            output.append(f"\n{i}. [{pain['severity'].upper()}] {pain['quote'][:100]}...")
    
    # 功能请求
    if analysis['feature_requests']:
        output.append("\n💡 功能请求:")
        for i, req in enumerate(analysis['feature_requests'][:5], 1):
            output.append(f"\n{i}. [{req['type']}] 优先级: {req['priority']}")
            output.append(f"   \"{req['quote'][:100]}...\"")
    
    # 待办任务
    if analysis['jobs_to_be_done']:
        output.append("\n🎯 待办任务 (JTBD):")
        for i, job in enumerate(analysis['jobs_to_be_done'], 1):
            output.append(f"{i}. {job['job']}")
    
    # 关键主题
    if analysis['key_themes']:
        output.append("\n🏷️ 关键主题:")
        output.append(", ".join(analysis['key_themes']))
    
    # 关键引用
    if analysis['quotes']:
        output.append("\n💬 关键引用:")
        for i, quote in enumerate(analysis['quotes'][:3], 1):
            output.append(f'{i}. "{quote}"')
    
    # 指标
    if analysis['metrics_mentioned']:
        output.append("\n📈 提及的指标:")
        output.append(", ".join(analysis['metrics_mentioned']))
    
    # 竞争对手
    if analysis['competitors_mentioned']:
        output.append("\n🏢 提及的竞争对手:")
        output.append(", ".join(analysis['competitors_mentioned']))
    
    return "\n".join(output)

def main():
    import sys
    
    if len(sys.argv) < 2:
        print("用法: python customer_interview_analyzer.py <访谈记录文件.txt>")
        print("\n此工具分析客户访谈记录，提取以下内容:")
        print("  - 痛点和挫败感")
        print("  - 功能请求和建议")
        print("  - 待办任务")
        print("  - 情感分析")
        print("  - 关键主题和引用")
        sys.exit(1)
    
    # 读取访谈记录
    with open(sys.argv[1], 'r') as f:
        interview_text = f.read()
    
    # 分析
    analyzer = InterviewAnalyzer()
    analysis = analyzer.analyze_interview(interview_text)
    
    # 输出
    if len(sys.argv) > 2 and sys.argv[2] == 'json':
        print(json.dumps(analysis, indent=2))
    else:
        print(format_single_interview(analysis))

if __name__ == "__main__":
    main()
