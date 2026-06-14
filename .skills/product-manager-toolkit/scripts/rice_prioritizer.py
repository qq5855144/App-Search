#!/usr/bin/env python3
"""
RICE 优先级排序框架
计算功能优先级的 RICE 分数
RICE = (覆盖度 × 影响 × 信心) / 工作量
"""

import json
import csv
from typing import List, Dict, Tuple
import argparse

class RICECalculator:
    """计算功能优先级的 RICE 分数"""
    
    def __init__(self):
        self.impact_map = {
            'massive': 3.0,
            'high': 2.0,
            'medium': 1.0,
            'low': 0.5,
            'minimal': 0.25
        }
        
        self.confidence_map = {
            'high': 100,
            'medium': 80,
            'low': 50
        }
        
        self.effort_map = {
            'xl': 13,
            'l': 8,
            'm': 5,
            's': 3,
            'xs': 1
        }
    
    def calculate_rice(self, reach: int, impact: str, confidence: str, effort: str) -> float:
        """
        计算 RICE 分数
        
        Args:
            reach: 每季度影响的用户数
            impact: massive/high/medium/low/minimal
            confidence: high/medium/low (百分比)
            effort: xl/l/m/s/xs (人月)
        """
        impact_score = self.impact_map.get(impact.lower(), 1.0)
        confidence_score = self.confidence_map.get(confidence.lower(), 50) / 100
        effort_score = self.effort_map.get(effort.lower(), 5)
        
        if effort_score == 0:
            return 0
        
        rice_score = (reach * impact_score * confidence_score) / effort_score
        return round(rice_score, 2)
    
    def prioritize_features(self, features: List[Dict]) -> List[Dict]:
        """
        计算 RICE 分数并排序功能
        
        Args:
            features: 包含 RICE 要素的功能字典列表
        """
        for feature in features:
            feature['rice_score'] = self.calculate_rice(
                feature.get('reach', 0),
                feature.get('impact', 'medium'),
                feature.get('confidence', 'medium'),
                feature.get('effort', 'm')
            )
        
        # 按 RICE 分数降序排列
        return sorted(features, key=lambda x: x['rice_score'], reverse=True)
    
    def analyze_portfolio(self, features: List[Dict]) -> Dict:
        """
        分析功能组合的平衡性和洞察
        """
        if not features:
            return {}
        
        total_effort = sum(
            self.effort_map.get(f.get('effort', 'm').lower(), 5) 
            for f in features
        )
        
        total_reach = sum(f.get('reach', 0) for f in features)
        
        effort_distribution = {}
        impact_distribution = {}
        
        for feature in features:
            effort = feature.get('effort', 'm').lower()
            impact = feature.get('impact', 'medium').lower()
            
            effort_distribution[effort] = effort_distribution.get(effort, 0) + 1
            impact_distribution[impact] = impact_distribution.get(impact, 0) + 1
        
        # 计算速赢项目（高影响、低工作量）
        quick_wins = [
            f for f in features 
            if f.get('impact', '').lower() in ['massive', 'high'] 
            and f.get('effort', '').lower() in ['xs', 's']
        ]
        
        # 计算大赌注（高影响、高工作量）
        big_bets = [
            f for f in features 
            if f.get('impact', '').lower() in ['massive', 'high'] 
            and f.get('effort', '').lower() in ['l', 'xl']
        ]
        
        return {
            'total_features': len(features),
            'total_effort_months': total_effort,
            'total_reach': total_reach,
            'average_rice': round(sum(f['rice_score'] for f in features) / len(features), 2),
            'effort_distribution': effort_distribution,
            'impact_distribution': impact_distribution,
            'quick_wins': len(quick_wins),
            'big_bets': len(big_bets),
            'quick_wins_list': quick_wins[:3],  # Top 3 速赢项目
            'big_bets_list': big_bets[:3]  # Top 3 大赌注
        }
    
    def generate_roadmap(self, features: List[Dict], team_capacity: int = 10) -> List[Dict]:
        """
        基于团队容量生成季度路线图
        
        Args:
            features: 已排序的功能列表
            team_capacity: 每季度可用的人月数
        """
        quarters = []
        current_quarter = {
            'quarter': 1,
            'features': [],
            'capacity_used': 0,
            'capacity_available': team_capacity
        }
        
        for feature in features:
            effort = self.effort_map.get(feature.get('effort', 'm').lower(), 5)
            
            if current_quarter['capacity_used'] + effort <= team_capacity:
                current_quarter['features'].append(feature)
                current_quarter['capacity_used'] += effort
            else:
                # 进入下一季度
                current_quarter['capacity_available'] = team_capacity - current_quarter['capacity_used']
                quarters.append(current_quarter)
                
                current_quarter = {
                    'quarter': len(quarters) + 1,
                    'features': [feature],
                    'capacity_used': effort,
                    'capacity_available': team_capacity - effort
                }
        
        if current_quarter['features']:
            current_quarter['capacity_available'] = team_capacity - current_quarter['capacity_used']
            quarters.append(current_quarter)
        
        return quarters

def format_output(features: List[Dict], analysis: Dict, roadmap: List[Dict]) -> str:
    """格式化结果显示"""
    output = ["=" * 60]
    output.append("RICE 优先级排序结果")
    output.append("=" * 60)
    
    # Top 功能
    output.append("\n📊 排名 Top 功能")
    for i, feature in enumerate(features[:10], 1):
        output.append(f"{i}. {feature.get('name', '未命名')}")
        output.append(f"   RICE 分数: {feature['rice_score']}")
        output.append(f"   覆盖度: {feature.get('reach', 0)} | 影响: {feature.get('impact', 'medium')} | "
                     f"信心: {feature.get('confidence', 'medium')} | 工作量: {feature.get('effort', 'm')}")
        output.append("")
    
    # 组合分析
    output.append("\n📈 组合分析")
    output.append(f"功能总数: {analysis.get('total_features', 0)}")
    output.append(f"总工作量: {analysis.get('total_effort_months', 0)} 人月")
    output.append(f"总覆盖度: {analysis.get('total_reach', 0):,} 用户")
    output.append(f"平均 RICE 分数: {analysis.get('average_rice', 0)}")
    
    output.append(f"\n🎯 速赢项目: {analysis.get('quick_wins', 0)} 个")
    for qw in analysis.get('quick_wins_list', []):
        output.append(f"   • {qw.get('name', '未命名')} (RICE: {qw['rice_score']})")
    
    output.append(f"\n🚀 大赌注: {analysis.get('big_bets', 0)} 个")
    for bb in analysis.get('big_bets_list', []):
        output.append(f"   • {bb.get('name', '未命名')} (RICE: {bb['rice_score']})")
    
    # 路线图
    output.append("\n\n📅 建议路线图")
    for quarter in roadmap:
        output.append(f"\nQ{quarter['quarter']} - 容量: {quarter['capacity_used']}/{quarter['capacity_used'] + quarter['capacity_available']} 人月")
        for feature in quarter['features']:
            output.append(f"   • {feature.get('name', '未命名')} (RICE: {feature['rice_score']})")
    
    return "\n".join(output)

def load_features_from_csv(filepath: str) -> List[Dict]:
    """从 CSV 文件加载功能"""
    features = []
    with open(filepath, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            feature = {
                'name': row.get('name', ''),
                'reach': int(row.get('reach', 0)),
                'impact': row.get('impact', 'medium'),
                'confidence': row.get('confidence', 'medium'),
                'effort': row.get('effort', 'm'),
                'description': row.get('description', '')
            }
            features.append(feature)
    return features

def create_sample_csv(filepath: str):
    """创建示例 CSV 文件"""
    sample_features = [
        ['name', 'reach', 'impact', 'confidence', 'effort', 'description'],
        ['用户仪表盘重设计', '5000', 'high', 'high', 'l', '完整重设计仪表盘界面'],
        ['移动端推送通知', '10000', 'massive', 'medium', 'm', '增加 iOS 和 Android 推送'],
        ['深色模式', '8000', 'medium', 'high', 's', '实现深色主题'],
        ['API 速率限制', '2000', 'low', 'high', 'xs', '为 API 添加速率限制'],
        ['社交登录', '12000', 'high', 'medium', 'm', '增加 Google/微信登录'],
        ['PDF 导出', '3000', 'medium', 'low', 's', '导出报告为 PDF'],
        ['团队协作', '4000', 'massive', 'low', 'xl', '实时协作功能'],
        ['搜索优化', '15000', 'high', 'high', 'm', '增强搜索功能'],
        ['上手引导', '20000', 'massive', 'high', 's', '改进新用户上手体验'],
        ['数据分析仪表盘', '6000', 'high', 'medium', 'l', '高级用户分析'],
    ]
    
    with open(filepath, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(sample_features)
    
    print(f"示例 CSV 已创建: {filepath}")

def main():
    parser = argparse.ArgumentParser(description='功能优先级排序的 RICE 框架')
    parser.add_argument('input', nargs='?', help='包含功能的 CSV 文件或 "sample" 创建示例')
    parser.add_argument('--capacity', type=int, default=10, help='每季度团队容量（人月）')
    parser.add_argument('--output', choices=['text', 'json', 'csv'], default='text', help='输出格式')
    
    args = parser.parse_args()
    
    # 创建示例
    if args.input == 'sample':
        create_sample_csv('sample_features.csv')
        return
    
    # 无输入时使用示例数据
    if not args.input:
        features = [
            {'name': '用户仪表盘', 'reach': 5000, 'impact': 'high', 'confidence': 'high', 'effort': 'l'},
            {'name': '推送通知', 'reach': 10000, 'impact': 'massive', 'confidence': 'medium', 'effort': 'm'},
            {'name': '深色模式', 'reach': 8000, 'impact': 'medium', 'confidence': 'high', 'effort': 's'},
            {'name': 'API 速率限制', 'reach': 2000, 'impact': 'low', 'confidence': 'high', 'effort': 'xs'},
            {'name': '社交登录', 'reach': 12000, 'impact': 'high', 'confidence': 'medium', 'effort': 'm'},
        ]
    else:
        features = load_features_from_csv(args.input)
    
    # 计算 RICE 分数
    calculator = RICECalculator()
    prioritized = calculator.prioritize_features(features)
    analysis = calculator.analyze_portfolio(prioritized)
    roadmap = calculator.generate_roadmap(prioritized, args.capacity)
    
    # 输出结果
    if args.output == 'json':
        result = {
            'features': prioritized,
            'analysis': analysis,
            'roadmap': roadmap
        }
        print(json.dumps(result, indent=2))
    elif args.output == 'csv':
        # 输出为 CSV
        if prioritized:
            keys = prioritized[0].keys()
            print(','.join(keys))
            for feature in prioritized:
                print(','.join(str(feature.get(k, '')) for k in keys))
    else:
        print(format_output(prioritized, analysis, roadmap))

if __name__ == "__main__":
    main()
