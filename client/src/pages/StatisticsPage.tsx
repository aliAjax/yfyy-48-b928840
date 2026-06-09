import { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  DatePicker,
  Select,
  Form,
  Button,
  Table,
  Tag,
  Space,
  Typography,
  Progress,
  Tabs,
  Divider,
  Radio,
  Tooltip,
} from 'antd';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  FallOutlined,
  BarChartOutlined,
  ReloadOutlined,
  TeamOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  EditOutlined,
  SyncOutlined,
  PieChartOutlined,
  LineChartOutlined,
  TrophyOutlined,
  AppstoreOutlined,
  InfoCircleOutlined,
  FileSearchOutlined,
  ExceptionOutlined,
  RetweetOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import {
  getFullOverview,
  getDailyTrend,
  getMonthlyTrend,
  getMatterRank,
  getDepartmentStats,
  getStatusStats,
  getUserStats,
  getWarningStats,
  getDepartmentList,
  getSupplementAnalysis,
} from '../api/statsApi';
import { listMatters } from '../api/matterApi';
import {
  FullStatsOverview,
  DailyTrendItem,
  MonthlyTrendItem,
  MatterRankItem,
  DepartmentStatsItem,
  StatusStatsItem,
  UserStatsItem,
  WarningStats,
  Matter,
  SupplementAnalysisData,
  SupplementReasonItem,
  SupplementMatterItem,
  SupplementMaterialItem,
  SupplementRepeatItem,
  SupplementAnalysisOverview,
} from '../types';
import { statusLabels, statusColors, roleLabels } from '../utils/common';
import { useNavigate } from 'react-router-dom';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

type TrendType = 'daily' | 'monthly';

export default function StatisticsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [trendType, setTrendType] = useState<TrendType>('daily');
  const navigate = useNavigate();

  const [overview, setOverview] = useState<FullStatsOverview>({
    totalCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    avgDuration: 0,
    approvalRate: 0,
    rejectionRate: 0,
    inProgressCount: 0,
    supplementCount: 0,
    warningCount: 0,
    overdueCount: 0,
    supplementRate: 0,
    warningRate: 0,
    overdueRate: 0,
  });

  const [dailyTrend, setDailyTrend] = useState<DailyTrendItem[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrendItem[]>([]);
  const [matterRank, setMatterRank] = useState<MatterRankItem[]>([]);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStatsItem[]>([]);
  const [statusStats, setStatusStats] = useState<StatusStatsItem[]>([]);
  const [userStats, setUserStats] = useState<UserStatsItem[]>([]);
  const [warningStats, setWarningStats] = useState<WarningStats>({
    totalCount: 0,
    normalCount: 0,
    warningCount: 0,
    overdueCount: 0,
    warningRate: 0,
    overdueRate: 0,
  });
  const [departments, setDepartments] = useState<string[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);

  const [supplementAnalysis, setSupplementAnalysis] = useState<SupplementAnalysisData>({
    overview: {
      totalSupplementCount: 0,
      totalApplicationsWithSupplement: 0,
      avgSupplementPerApplication: 0,
      maxSupplementCount: 0,
    },
    topReasons: [],
    topMatters: [],
    topMaterials: [],
    repeatedSupplements: [],
  });

  const quickDateOptions = [
    { label: '今日', getRange: () => [dayjs(), dayjs()] },
    { label: '本周', getRange: () => [dayjs().startOf('week'), dayjs().endOf('week')] },
    { label: '本月', getRange: () => [dayjs().startOf('month'), dayjs().endOf('month')] },
    {
      label: '本季度',
      getRange: () => {
        const month = dayjs().month();
        const quarter = Math.floor(month / 3);
        const startMonth = quarter * 3;
        const endMonth = startMonth + 2;
        return [
          dayjs().month(startMonth).startOf('month'),
          dayjs().month(endMonth).endOf('month'),
        ];
      },
    },
    { label: '本年', getRange: () => [dayjs().startOf('year'), dayjs().endOf('year')] },
  ];

  useEffect(() => {
    loadOptions();
    const endDate = dayjs();
    const startDate = dayjs().subtract(30, 'day');
    form.setFieldsValue({
      dateRange: [startDate, endDate],
    });
    loadAllStats({
      startDate: startDate.format('YYYY-MM-DD'),
      endDate: endDate.format('YYYY-MM-DD'),
    });
  }, []);

  const loadOptions = async () => {
    try {
      const [deptRes, matterRes] = await Promise.all([
        getDepartmentList(),
        listMatters({ status: 'active', pageSize: 100 }),
      ]);
      if (deptRes.success) {
        setDepartments(deptRes.data || []);
      }
      if (matterRes.success) {
        setMatters(matterRes.data || []);
      }
    } catch (error) {
      console.error('加载筛选选项失败', error);
    }
  };

  const loadAllStats = async (params?: any) => {
    setLoading(true);
    try {
      const [
        overviewRes,
        dailyRes,
        monthlyRes,
        rankRes,
        deptRes,
        statusRes,
        userRes,
        warningRes,
        supplementRes,
      ] = await Promise.all([
        getFullOverview(params),
        getDailyTrend(params),
        getMonthlyTrend(params),
        getMatterRank({ ...params, limit: 15 }),
        getDepartmentStats(params),
        getStatusStats(params),
        getUserStats(params),
        getWarningStats(params),
        getSupplementAnalysis(params),
      ]);

      if (overviewRes.success) setOverview(overviewRes.data || ({} as FullStatsOverview));
      if (dailyRes.success) setDailyTrend(dailyRes.data || []);
      if (monthlyRes.success) setMonthlyTrend(monthlyRes.data || []);
      if (rankRes.success) setMatterRank(rankRes.data || []);
      if (deptRes.success) setDepartmentStats(deptRes.data || []);
      if (statusRes.success) setStatusStats(statusRes.data || []);
      if (userRes.success) setUserStats(userRes.data || []);
      if (warningRes.success) setWarningStats(warningRes.data || ({} as WarningStats));
      if (supplementRes.success) setSupplementAnalysis(supplementRes.data || ({} as SupplementAnalysisData));
    } catch (error) {
      console.error('加载统计数据失败', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (values: any) => {
    const { dateRange, department, matterId, status } = values;
    const params: any = {};
    if (dateRange && dateRange.length === 2) {
      params.startDate = dateRange[0].format('YYYY-MM-DD');
      params.endDate = dateRange[1].format('YYYY-MM-DD');
    }
    if (department) params.department = department;
    if (matterId) params.matterId = matterId;
    if (status) params.status = status;
    loadAllStats(params);
  };

  const handleReset = () => {
    const endDate = dayjs();
    const startDate = dayjs().subtract(30, 'day');
    form.setFieldsValue({
      dateRange: [startDate, endDate],
      department: undefined,
      matterId: undefined,
      status: undefined,
    });
    loadAllStats({
      startDate: startDate.format('YYYY-MM-DD'),
      endDate: endDate.format('YYYY-MM-DD'),
    });
  };

  const handleQuickDate = (index: number) => {
    const [start, end] = quickDateOptions[index].getRange();
    form.setFieldsValue({ dateRange: [start, end] });
    loadAllStats({
      startDate: start.format('YYYY-MM-DD'),
      endDate: end.format('YYYY-MM-DD'),
    });
  };

  const getTrendOption = () => {
    const trendData = trendType === 'daily' ? dailyTrend : monthlyTrend;
    const xKey = trendType === 'daily' ? 'date' : 'month';
    const labels = trendData.map((item: any) => item[xKey]);
    const totalData = trendData.map(item => item.totalCount);
    const approvedData = trendData.map(item => item.approvedCount);
    const rejectedData = trendData.map(item => item.rejectedCount);

    return {
      tooltip: {
        trigger: 'axis',
      },
      legend: {
        data: ['申请总数', '通过数', '退回数'],
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: labels,
      },
      yAxis: {
        type: 'value',
      },
      series: [
        {
          name: '申请总数',
          type: 'line',
          smooth: true,
          data: totalData,
          itemStyle: { color: '#1890ff' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
                { offset: 1, color: 'rgba(24, 144, 255, 0.05)' },
              ],
            },
          },
        },
        {
          name: '通过数',
          type: 'line',
          smooth: true,
          data: approvedData,
          itemStyle: { color: '#52c41a' },
        },
        {
          name: '退回数',
          type: 'line',
          smooth: true,
          data: rejectedData,
          itemStyle: { color: '#ff4d4f' },
        },
      ],
    };
  };

  const getDeptPieOption = () => {
    const data = departmentStats.map(item => ({
      value: item.totalCount,
      name: item.department,
    }));

    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        left: 'left',
      },
      series: [
        {
          name: '部门申请量',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: false,
            position: 'center',
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 20,
              fontWeight: 'bold',
            },
          },
          labelLine: {
            show: false,
          },
          data,
        },
      ],
    };
  };

  const getStatusPieOption = () => {
    const data = statusStats.map(item => ({
      value: item.count,
      name: statusLabels[item.status as keyof typeof statusLabels] || item.status,
    }));

    const colorMap: Record<string, string> = {
      '草稿': '#bfbfbf',
      '待受理': '#1890ff',
      '已受理': '#1890ff',
      '待补正': '#faad14',
      '审核中': '#1890ff',
      '审核通过': '#52c41a',
      '已退回': '#ff4d4f',
      '已办结': '#52c41a',
    };

    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        left: 'left',
      },
      series: [
        {
          name: '状态分布',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: false,
            position: 'center',
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 18,
              fontWeight: 'bold',
            },
          },
          labelLine: {
            show: false,
          },
          data: data.map(item => ({
            ...item,
            itemStyle: { color: colorMap[item.name] || '#1890ff' },
          })),
        },
      ],
    };
  };

  const getDeptBarOption = () => {
    const departments = departmentStats.map(item => item.department);
    const totalData = departmentStats.map(item => item.totalCount);
    const approvedData = departmentStats.map(item => item.approvedCount);
    const rejectedData = departmentStats.map(item => item.rejectedCount);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
      },
      legend: {
        data: ['申请总数', '通过数', '退回数'],
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: departments,
        axisLabel: {
          rotate: 30,
          interval: 0,
        },
      },
      yAxis: {
        type: 'value',
      },
      series: [
        {
          name: '申请总数',
          type: 'bar',
          data: totalData,
          itemStyle: { color: '#1890ff' },
        },
        {
          name: '通过数',
          type: 'bar',
          data: approvedData,
          itemStyle: { color: '#52c41a' },
        },
        {
          name: '退回数',
          type: 'bar',
          data: rejectedData,
          itemStyle: { color: '#ff4d4f' },
        },
      ],
    };
  };

  const getWarningOption = () => {
    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        bottom: 10,
        left: 'center',
      },
      series: [
        {
          name: '预警状态',
          type: 'pie',
          radius: ['45%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: false,
            position: 'center',
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 18,
              fontWeight: 'bold',
            },
          },
          labelLine: {
            show: false,
          },
          data: [
            { value: warningStats.normalCount, name: '正常', itemStyle: { color: '#52c41a' } },
            { value: warningStats.warningCount, name: '即将超期', itemStyle: { color: '#faad14' } },
            { value: warningStats.overdueCount, name: '已超期', itemStyle: { color: '#ff4d4f' } },
          ],
        },
      ],
    };
  };

  const handleJumpToApplications = (filters: {
    matterId?: string;
    matterName?: string;
    hasSupplement?: boolean;
    supplementReason?: string;
    applicationIds?: string[];
  }) => {
    navigate('/applications', {
      state: filters,
    });
  };

  const handleJumpToApplicationDetail = (applicationId: string) => {
    navigate(`/applications/${applicationId}`);
  };

  const getSupplementReasonBarOption = () => {
    const top10Reasons = supplementAnalysis.topReasons.slice(0, 10);
    const reasons = top10Reasons.map(item => item.reason.length > 15 ? item.reason.substring(0, 15) + '...' : item.reason);
    const counts = top10Reasons.map(item => item.count);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: reasons,
        axisLabel: {
          rotate: 30,
          interval: 0,
          fontSize: 11,
        },
      },
      yAxis: {
        type: 'value',
        name: '次数',
      },
      series: [
        {
          name: '出现次数',
          type: 'bar',
          data: counts,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#faad14' },
                { offset: 1, color: '#ffc53d' },
              ],
            },
            borderRadius: [4, 4, 0, 0],
          },
          label: {
            show: true,
            position: 'top',
          },
        },
      ],
    };
  };

  const getSupplementMatterBarOption = () => {
    const top10Matters = supplementAnalysis.topMatters.slice(0, 10);
    const matterNames = top10Matters.map(item => item.matterName.length > 12 ? item.matterName.substring(0, 12) + '...' : item.matterName);
    const counts = top10Matters.map(item => item.supplementCount);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        name: '补正次数',
      },
      yAxis: {
        type: 'category',
        data: matterNames.reverse(),
        axisLabel: {
          fontSize: 11,
        },
      },
      series: [
        {
          name: '补正次数',
          type: 'bar',
          data: counts.reverse(),
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: '#722ed1' },
                { offset: 1, color: '#9254de' },
              ],
            },
            borderRadius: [0, 4, 4, 0],
          },
          label: {
            show: true,
            position: 'right',
          },
        },
      ],
    };
  };

  const getSupplementMaterialPieOption = () => {
    const data = supplementAnalysis.topMaterials.slice(0, 10).map(item => ({
      value: item.problemCount,
      name: item.materialName.length > 10 ? item.materialName.substring(0, 10) + '...' : item.materialName,
      fullName: item.materialName,
    }));

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => `${params.data.fullName || params.name}: ${params.value}次 (${params.percent}%)`,
      },
      legend: {
        type: 'scroll',
        orient: 'vertical',
        right: 10,
        top: 20,
        bottom: 20,
      },
      series: [
        {
          name: '问题材料',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
            },
          },
          labelLine: {
            show: false,
          },
          data,
        },
      ],
    };
  };

  const matterRankColumns = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 60,
      render: (_: any, __: any, index: number) => {
        const rank = index + 1;
        let color = '';
        if (rank === 1) color = '#f5222d';
        else if (rank === 2) color = '#fa8c16';
        else if (rank === 3) color = '#fadb14';
        else color = '#8c8c8c';
        return (
          <Text strong style={{ color, fontSize: 16 }}>
            {rank <= 3 ? <TrophyOutlined style={{ color }} /> : rank}
          </Text>
        );
      },
    },
    {
      title: '事项名称',
      dataIndex: 'matterName',
      key: 'matterName',
      ellipsis: true,
    },
    {
      title: '所属部门',
      dataIndex: 'department',
      key: 'department',
      width: 140,
    },
    {
      title: '申请数量',
      dataIndex: 'totalCount',
      key: 'totalCount',
      width: 100,
      sorter: (a: MatterRankItem, b: MatterRankItem) => a.totalCount - b.totalCount,
    },
    {
      title: '通过数',
      dataIndex: 'approvedCount',
      key: 'approvedCount',
      width: 80,
      render: (val: number) => <Tag color="success">{val}</Tag>,
    },
    {
      title: '退回数',
      dataIndex: 'rejectedCount',
      key: 'rejectedCount',
      width: 80,
      render: (val: number) => <Tag color="error">{val}</Tag>,
    },
    {
      title: '通过率',
      dataIndex: 'approvalRate',
      key: 'approvalRate',
      width: 180,
      render: (val: number) => (
        <Progress
          percent={val}
          size="small"
          status={val >= 80 ? 'success' : val >= 50 ? 'normal' : 'exception'}
        />
      ),
    },
    {
      title: '平均时长(天)',
      dataIndex: 'avgDuration',
      key: 'avgDuration',
      width: 110,
      render: (val: number) => val || '-',
    },
  ];

  const userRankColumns = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 60,
      render: (_: any, __: any, index: number) => {
        const rank = index + 1;
        let color = '';
        if (rank === 1) color = '#f5222d';
        else if (rank === 2) color = '#fa8c16';
        else if (rank === 3) color = '#fadb14';
        else color = '#8c8c8c';
        return (
          <Text strong style={{ color, fontSize: 16 }}>
            {rank <= 3 ? <TrophyOutlined style={{ color }} /> : rank}
          </Text>
        );
      },
    },
    {
      title: '办理人员',
      dataIndex: 'userName',
      key: 'userName',
      width: 120,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (val: string) => roleLabels[val as keyof typeof roleLabels] || val,
    },
    {
      title: '办理总数',
      dataIndex: 'totalCount',
      key: 'totalCount',
      width: 100,
      sorter: (a: UserStatsItem, b: UserStatsItem) => a.totalCount - b.totalCount,
    },
    {
      title: '通过数',
      dataIndex: 'approvedCount',
      key: 'approvedCount',
      width: 80,
      render: (val: number) => <Tag color="success">{val}</Tag>,
    },
    {
      title: '退回数',
      dataIndex: 'rejectedCount',
      key: 'rejectedCount',
      width: 80,
      render: (val: number) => <Tag color="error">{val}</Tag>,
    },
    {
      title: '平均办理时长(天)',
      dataIndex: 'avgDuration',
      key: 'avgDuration',
      width: 130,
      render: (val: number) => val || '-',
    },
  ];

  const statusStatsColumns = [
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (val: string) => (
        <Tag color={statusColors[val as keyof typeof statusColors] as any}>
          {statusLabels[val as keyof typeof statusLabels] || val}
        </Tag>
      ),
    },
    {
      title: '申请数量',
      dataIndex: 'totalCount',
      key: 'totalCount',
      width: 100,
      sorter: (a: StatusStatsItem, b: StatusStatsItem) => a.totalCount - b.totalCount,
    },
    {
      title: '通过数',
      dataIndex: 'approvedCount',
      key: 'approvedCount',
      width: 90,
      render: (val: number) => <Tag color="success">{val}</Tag>,
    },
    {
      title: '退回数',
      dataIndex: 'rejectedCount',
      key: 'rejectedCount',
      width: 90,
      render: (val: number) => <Tag color="error">{val}</Tag>,
    },
    {
      title: '通过率',
      dataIndex: 'approvalRate',
      key: 'approvalRate',
      width: 170,
      render: (val: number) => (
        <Progress
          percent={val}
          size="small"
          status={val >= 80 ? 'success' : val >= 50 ? 'normal' : 'exception'}
        />
      ),
    },
    {
      title: '退回率',
      dataIndex: 'rejectionRate',
      key: 'rejectionRate',
      width: 170,
      render: (val: number) => (
        <Progress percent={val} size="small" status="exception" />
      ),
    },
    {
      title: '平均办理时长(天)',
      dataIndex: 'avgDuration',
      key: 'avgDuration',
      width: 140,
      render: (val: number) => val || '-',
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>数据统计分析</Title>
        <Text type="secondary">全面展示审批办理情况，助力管理决策</Text>
      </div>

      <Card
        style={{ marginBottom: 16 }}
        bodyStyle={{ paddingBottom: 0 }}
      >
        <Space size={8} style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>快捷筛选：</Text>
          {quickDateOptions.map((opt, idx) => (
            <Button size="small" key={idx} onClick={() => handleQuickDate(idx)}>
              {opt.label}
            </Button>
          ))}
        </Space>
        <Form
          form={form}
          layout="inline"
          onFinish={handleSearch}
          style={{ marginBottom: 16 }}
        >
          <Form.Item label="日期范围" name="dateRange">
            <RangePicker style={{ width: 260 }} />
          </Form.Item>
          <Form.Item label="部门" name="department">
            <Select
              placeholder="全部部门"
              style={{ width: 160 }}
              allowClear
              options={departments.map(d => ({ label: d, value: d }))}
            />
          </Form.Item>
          <Form.Item label="事项" name="matterId">
            <Select
              placeholder="全部事项"
              style={{ width: 200 }}
              allowClear
              showSearch
              optionFilterProp="label"
              options={matters.map(m => ({ label: m.name, value: m.id }))}
            />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Select
              placeholder="全部状态"
              style={{ width: 140 }}
              allowClear
              options={Object.entries(statusLabels).map(([value, label]) => ({ label, value }))}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<BarChartOutlined />}>
                查询
              </Button>
              <Button onClick={handleReset} icon={<ReloadOutlined />}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane
          tab={
            <span>
              <AppstoreOutlined />
              数据概览
            </span>
          }
          key="overview"
        >
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={4}>
              <Card loading={loading}>
                <Statistic
                  title="申请总数"
                  value={overview.totalCount}
                  prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card loading={loading}>
                <Statistic
                  title="在办中"
                  value={overview.inProgressCount}
                  prefix={<SyncOutlined style={{ color: '#1890ff' }} />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card loading={loading}>
                <Statistic
                  title="已通过"
                  value={overview.approvedCount}
                  prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card loading={loading}>
                <Statistic
                  title="已退回"
                  value={overview.rejectedCount}
                  prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card loading={loading}>
                <Statistic
                  title="待补正"
                  value={overview.supplementCount}
                  prefix={<EditOutlined style={{ color: '#faad14' }} />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card loading={loading}>
                <Statistic
                  title="平均办理时长"
                  value={overview.avgDuration}
                  suffix="天"
                  prefix={<ClockCircleOutlined style={{ color: '#722ed1' }} />}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Card loading={loading} title="通过率">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text type="secondary">通过 / 总数</Text>
                  <Tag icon={<RiseOutlined />} color="success">{overview.approvalRate}%</Tag>
                </div>
                <Progress
                  percent={overview.approvalRate}
                  status="success"
                  strokeColor={{
                    '0%': '#52c41a',
                    '100%': '#73d13d',
                  }}
                  format={(percent) => `${overview.approvedCount} / ${overview.totalCount}`}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card loading={loading} title="退回率">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text type="secondary">退回 / 总数</Text>
                  <Tag icon={<FallOutlined />} color="error">{overview.rejectionRate}%</Tag>
                </div>
                <Progress
                  percent={overview.rejectionRate}
                  status="exception"
                  strokeColor={{
                    '0%': '#ff4d4f',
                    '100%': '#ff7875',
                  }}
                  format={(percent) => `${overview.rejectedCount} / ${overview.totalCount}`}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card loading={loading} title="补正率">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text type="secondary">补正 / 总数</Text>
                  <Tag icon={<EditOutlined />} color="warning">{overview.supplementRate}%</Tag>
                </div>
                <Progress
                  percent={overview.supplementRate}
                  strokeColor={{
                    '0%': '#faad14',
                    '100%': '#ffc53d',
                  }}
                  format={(percent) => `${overview.supplementCount} / ${overview.totalCount}`}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={16}>
              <Card
                loading={loading}
                title="申请趋势"
                extra={
                  <Radio.Group size="small" value={trendType} onChange={e => setTrendType(e.target.value)}>
                    <Radio.Button value="daily">日趋势</Radio.Button>
                    <Radio.Button value="monthly">月趋势</Radio.Button>
                  </Radio.Group>
                }
              >
                <ReactECharts option={getTrendOption()} style={{ height: 320 }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card loading={loading} title="状态分布">
                <ReactECharts option={getStatusPieOption()} style={{ height: 320 }} />
              </Card>
            </Col>
          </Row>

          <Card loading={loading} title="状态办理明细">
            <Table
              dataSource={statusStats}
              columns={statusStatsColumns}
              rowKey="status"
              pagination={false}
              size="middle"
            />
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <TeamOutlined />
              部门分析
            </span>
          }
          key="department"
        >
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={10}>
              <Card loading={loading} title="部门申请量分布">
                <ReactECharts option={getDeptPieOption()} style={{ height: 350 }} />
              </Card>
            </Col>
            <Col span={14}>
              <Card loading={loading} title="各部门办理情况对比">
                <ReactECharts option={getDeptBarOption()} style={{ height: 350 }} />
              </Card>
            </Col>
          </Row>

          <Card loading={loading} title="部门详细数据">
            <Table
              dataSource={departmentStats}
              rowKey="department"
              pagination={false}
              size="middle"
              columns={[
                {
                  title: '排名',
                  key: 'rank',
                  width: 60,
                  render: (_: any, __: any, index: number) => index + 1,
                },
                {
                  title: '部门名称',
                  dataIndex: 'department',
                  key: 'department',
                },
                {
                  title: '申请总数',
                  dataIndex: 'totalCount',
                  key: 'totalCount',
                  width: 100,
                  sorter: (a: DepartmentStatsItem, b: DepartmentStatsItem) => a.totalCount - b.totalCount,
                },
                {
                  title: '通过数',
                  dataIndex: 'approvedCount',
                  key: 'approvedCount',
                  width: 90,
                  render: (val: number) => <Tag color="success">{val}</Tag>,
                },
                {
                  title: '退回数',
                  dataIndex: 'rejectedCount',
                  key: 'rejectedCount',
                  width: 90,
                  render: (val: number) => <Tag color="error">{val}</Tag>,
                },
                {
                  title: '通过率',
                  dataIndex: 'approvalRate',
                  key: 'approvalRate',
                  width: 170,
                  render: (val: number) => (
                    <Progress
                      percent={val}
                      size="small"
                      status={val >= 80 ? 'success' : val >= 50 ? 'normal' : 'exception'}
                    />
                  ),
                },
                {
                  title: '退回率',
                  dataIndex: 'rejectionRate',
                  key: 'rejectionRate',
                  width: 170,
                  render: (val: number) => (
                    <Progress percent={val} size="small" status="exception" />
                  ),
                },
                {
                  title: '平均办理时长(天)',
                  dataIndex: 'avgDuration',
                  key: 'avgDuration',
                  width: 140,
                  render: (val: number) => val || '-',
                },
              ]}
            />
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <TrophyOutlined />
              人员排行
            </span>
          }
          key="user"
        >
          <Card loading={loading} title="办理人员排行榜">
            <Table
              dataSource={userStats}
              columns={userRankColumns}
              rowKey="userId"
              pagination={false}
              size="middle"
            />
            {userStats.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                暂无数据
              </div>
            )}
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <BarChartOutlined />
              事项排行
            </span>
          }
          key="matter"
        >
          <Card loading={loading} title="事项办理排行榜" extra={<Text type="secondary">TOP 15</Text>}>
            <Table
              dataSource={matterRank}
              columns={matterRankColumns}
              rowKey="matterId"
              pagination={false}
              size="middle"
            />
            {matterRank.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                暂无数据
              </div>
            )}
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <WarningOutlined />
              预警分析
            </span>
          }
          key="warning"
        >
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card loading={loading}>
                <Statistic
                  title="在办总数"
                  value={warningStats.totalCount}
                  prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card loading={loading}>
                <Statistic
                  title="正常办理"
                  value={warningStats.normalCount}
                  prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card loading={loading}>
                <Statistic
                  title="即将超期"
                  value={warningStats.warningCount}
                  prefix={<WarningOutlined style={{ color: '#faad14' }} />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card loading={loading}>
                <Statistic
                  title="已超期"
                  value={warningStats.overdueCount}
                  prefix={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={10}>
              <Card loading={loading} title="预警状态分布">
                <ReactECharts option={getWarningOption()} style={{ height: 350 }} />
              </Card>
            </Col>
            <Col span={14}>
              <Card loading={loading} title="预警指标">
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text>正常办理率</Text>
                    <Text strong style={{ color: '#52c41a' }}>
                      {warningStats.totalCount > 0
                        ? ((warningStats.normalCount / warningStats.totalCount) * 100).toFixed(2)
                        : 0}%
                    </Text>
                  </div>
                  <Progress
                    percent={warningStats.totalCount > 0
                      ? ((warningStats.normalCount / warningStats.totalCount) * 100)
                      : 0}
                    status="success"
                    showInfo={false}
                  />
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text>即将超期率</Text>
                    <Text strong style={{ color: '#faad14' }}>{warningStats.warningRate}%</Text>
                  </div>
                  <Progress
                    percent={warningStats.warningRate}
                    strokeColor="#faad14"
                    showInfo={false}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text>超期率</Text>
                    <Text strong style={{ color: '#ff4d4f' }}>{warningStats.overdueRate}%</Text>
                  </div>
                  <Progress
                    percent={warningStats.overdueRate}
                    status="exception"
                    showInfo={false}
                  />
                </div>

                <Divider />

                <div style={{ marginTop: 16 }}>
                  <Text type="secondary">说明：</Text>
                  <ul style={{ marginTop: 8, paddingLeft: 20, color: '#999' }}>
                    <li>预警规则按事项单独配置，可在事项管理中设置提前预警天数和是否排除补正时间</li>
                    <li>正常：剩余天数 {'>'} 提前预警天数</li>
                    <li>即将超期：0 {'<'} 剩余天数 ≤ 提前预警天数</li>
                    <li>已超期：剩余天数 ≤ 0</li>
                    <li>默认提前预警 3 天，未配置时按默认规则计算</li>
                  </ul>
                </div>
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane
          tab={
            <span>
              <ExceptionOutlined />
              补正原因分析
            </span>
          }
          key="supplement"
        >
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card loading={loading}>
                <Statistic
                  title="补正总次数"
                  value={supplementAnalysis.overview.totalSupplementCount}
                  prefix={<EditOutlined style={{ color: '#faad14' }} />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card loading={loading}>
                <Statistic
                  title="涉及申请数"
                  value={supplementAnalysis.overview.totalApplicationsWithSupplement}
                  prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card loading={loading}>
                <Statistic
                  title="平均补正次数"
                  value={supplementAnalysis.overview.avgSupplementPerApplication}
                  prefix={<SyncOutlined style={{ color: '#722ed1' }} />}
                  valueStyle={{ color: '#722ed1' }}
                  suffix="次/申请"
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card loading={loading}>
                <Statistic
                  title="最高补正次数"
                  value={supplementAnalysis.overview.maxSupplementCount}
                  prefix={<ExceptionOutlined style={{ color: '#ff4d4f' }} />}
                  valueStyle={{ color: '#ff4d4f' }}
                  suffix="次"
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={14}>
              <Card
                loading={loading}
                title="高频补正原因 TOP 10"
                extra={
                  <Button
                    type="link"
                    size="small"
                    icon={<FileSearchOutlined />}
                    onClick={() => {
                      const allIds = new Set<string>();
                      supplementAnalysis.topReasons.forEach(r => r.applicationIds.forEach(id => allIds.add(id)));
                      supplementAnalysis.topMatters.forEach(m => m.applicationIds.forEach(id => allIds.add(id)));
                      supplementAnalysis.topMaterials.forEach(m => m.applicationIds.forEach(id => allIds.add(id)));
                      supplementAnalysis.repeatedSupplements.forEach(r => allIds.add(r.applicationId));
                      handleJumpToApplications({
                        hasSupplement: true,
                        applicationIds: Array.from(allIds),
                      });
                    }}
                  >
                    查看全部补正申请
                  </Button>
                }
              >
                <ReactECharts option={getSupplementReasonBarOption()} style={{ height: 340 }} />
              </Card>
            </Col>
            <Col span={10}>
              <Card loading={loading} title="涉及事项 TOP 10">
                <ReactECharts option={getSupplementMatterBarOption()} style={{ height: 340 }} />
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={10}>
              <Card loading={loading} title="问题材料分布">
                <ReactECharts option={getSupplementMaterialPieOption()} style={{ height: 350 }} />
                {supplementAnalysis.topMaterials.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                    暂无数据
                  </div>
                )}
              </Card>
            </Col>
            <Col span={14}>
              <Card
                loading={loading}
                title="高频补正原因明细"
                extra={
                  <Tooltip title="点击某行可跳转到对应申请列表">
                    <InfoCircleOutlined style={{ color: '#999' }} />
                  </Tooltip>
                }
              >
                <Table
                  dataSource={supplementAnalysis.topReasons}
                  rowKey="reason"
                  pagination={false}
                  size="middle"
                  onRow={(record) => ({
                    style: { cursor: 'pointer' },
                    onClick: () => handleJumpToApplications({
                      hasSupplement: true,
                      supplementReason: record.reason,
                      applicationIds: record.applicationIds,
                    }),
                  })}
                  columns={[
                    {
                      title: '排名',
                      key: 'rank',
                      width: 60,
                      render: (_: any, __: any, index: number) => {
                        const rank = index + 1;
                        let color = '';
                        if (rank === 1) color = '#f5222d';
                        else if (rank === 2) color = '#fa8c16';
                        else if (rank === 3) color = '#fadb14';
                        else color = '#8c8c8c';
                        return (
                          <Text strong style={{ color, fontSize: 16 }}>
                            {rank <= 3 ? <TrophyOutlined style={{ color }} /> : rank}
                          </Text>
                        );
                      },
                    },
                    {
                      title: '补正原因',
                      dataIndex: 'reason',
                      key: 'reason',
                      ellipsis: true,
                      render: (val: string) => (
                        <Tooltip title={val}>
                          <span>{val}</span>
                        </Tooltip>
                      ),
                    },
                    {
                      title: '出现次数',
                      dataIndex: 'count',
                      key: 'count',
                      width: 100,
                      sorter: (a: SupplementReasonItem, b: SupplementReasonItem) => a.count - b.count,
                      render: (val: number) => (
                        <Tag color={val >= 10 ? 'error' : val >= 5 ? 'warning' : 'processing'}>
                          {val} 次
                        </Tag>
                      ),
                    },
                    {
                      title: '涉及申请数',
                      dataIndex: 'applicationIds',
                      key: 'applicationCount',
                      width: 100,
                      render: (ids: string[]) => (
                        <Text strong>{ids.length}</Text>
                      ),
                    },
                    {
                      title: '操作',
                      key: 'action',
                      width: 100,
                      render: (_: any, record: SupplementReasonItem) => (
                        <Button
                          type="link"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleJumpToApplications({
                              hasSupplement: true,
                              supplementReason: record.reason,
                              applicationIds: record.applicationIds,
                            });
                          }}
                        >
                          查看申请
                        </Button>
                      ),
                    },
                  ]}
                />
                {supplementAnalysis.topReasons.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                    暂无数据
                  </div>
                )}
              </Card>
            </Col>
          </Row>

          <Card
            loading={loading}
            title="补正涉及事项明细"
            style={{ marginBottom: 16 }}
            extra={
              <Tooltip title="点击某行可跳转到对应申请列表">
                <InfoCircleOutlined style={{ color: '#999' }} />
              </Tooltip>
            }
          >
            <Table
              dataSource={supplementAnalysis.topMatters}
              rowKey="matterId"
              pagination={false}
              size="middle"
              onRow={(record) => ({
                style: { cursor: 'pointer' },
                onClick: () => handleJumpToApplications({
                  matterId: record.matterId,
                  matterName: record.matterName,
                  hasSupplement: true,
                  applicationIds: record.applicationIds,
                }),
              })}
              columns={[
                {
                  title: '排名',
                  key: 'rank',
                  width: 60,
                  render: (_: any, __: any, index: number) => index + 1,
                },
                {
                  title: '事项名称',
                  dataIndex: 'matterName',
                  key: 'matterName',
                },
                {
                  title: '所属部门',
                  dataIndex: 'department',
                  key: 'department',
                  width: 140,
                },
                {
                  title: '补正次数',
                  dataIndex: 'supplementCount',
                  key: 'supplementCount',
                  width: 100,
                  sorter: (a: SupplementMatterItem, b: SupplementMatterItem) => a.supplementCount - b.supplementCount,
                  render: (val: number) => (
                    <Tag color={val >= 10 ? 'error' : val >= 5 ? 'warning' : 'processing'}>
                      {val} 次
                    </Tag>
                  ),
                },
                {
                  title: '涉及申请数',
                  dataIndex: 'applicationIds',
                  key: 'applicationCount',
                  width: 100,
                  render: (ids: string[]) => <Text strong>{ids.length}</Text>,
                },
                {
                  title: '操作',
                  key: 'action',
                  width: 100,
                  render: (_: any, record: SupplementMatterItem) => (
                    <Button
                      type="link"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJumpToApplications({
                          matterId: record.matterId,
                          matterName: record.matterName,
                          hasSupplement: true,
                          applicationIds: record.applicationIds,
                        });
                      }}
                    >
                      查看申请
                    </Button>
                  ),
                },
              ]}
            />
            {supplementAnalysis.topMatters.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                暂无数据
              </div>
            )}
          </Card>

          <Card
            loading={loading}
            title="问题材料明细"
            style={{ marginBottom: 16 }}
          >
            <Table
              dataSource={supplementAnalysis.topMaterials}
              rowKey="materialName"
              pagination={false}
              size="middle"
              onRow={(record) => ({
                style: { cursor: 'pointer' },
                onClick: () => handleJumpToApplications({
                  hasSupplement: true,
                  applicationIds: record.applicationIds,
                }),
              })}
              columns={[
                {
                  title: '排名',
                  key: 'rank',
                  width: 60,
                  render: (_: any, __: any, index: number) => index + 1,
                },
                {
                  title: '材料名称',
                  dataIndex: 'materialName',
                  key: 'materialName',
                  ellipsis: true,
                  render: (val: string) => (
                    <Tooltip title={val}>
                      <span>{val}</span>
                    </Tooltip>
                  ),
                },
                {
                  title: '出现问题次数',
                  dataIndex: 'problemCount',
                  key: 'problemCount',
                  width: 120,
                  sorter: (a: SupplementMaterialItem, b: SupplementMaterialItem) => a.problemCount - b.problemCount,
                  render: (val: number) => (
                    <Tag color={val >= 10 ? 'error' : val >= 5 ? 'warning' : 'processing'}>
                      {val} 次
                    </Tag>
                  ),
                },
                {
                  title: '涉及申请数',
                  dataIndex: 'applicationIds',
                  key: 'applicationCount',
                  width: 100,
                  render: (ids: string[]) => <Text strong>{ids.length}</Text>,
                },
                {
                  title: '操作',
                  key: 'action',
                  width: 100,
                  render: (_: any, record: SupplementMaterialItem) => (
                    <Button
                      type="link"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJumpToApplications({
                          hasSupplement: true,
                          applicationIds: record.applicationIds,
                        });
                      }}
                    >
                      查看申请
                    </Button>
                  ),
                },
              ]}
            />
            {supplementAnalysis.topMaterials.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                暂无数据
              </div>
            )}
          </Card>

          <Card
            loading={loading}
            title="重复补正申请 TOP"
            extra={
              <Space>
                <RetweetOutlined style={{ color: '#ff4d4f' }} />
                <Text type="secondary" style={{ fontSize: 13 }}>同一申请补正次数 ≥ 2 次</Text>
              </Space>
            }
          >
            <Table
              dataSource={supplementAnalysis.repeatedSupplements}
              rowKey="applicationId"
              pagination={false}
              size="middle"
              onRow={(record) => ({
                style: { cursor: 'pointer' },
                onClick: () => handleJumpToApplicationDetail(record.applicationId),
              })}
              columns={[
                {
                  title: '排名',
                  key: 'rank',
                  width: 60,
                  render: (_: any, __: any, index: number) => {
                    const rank = index + 1;
                    let color = '';
                    if (rank === 1) color = '#f5222d';
                    else if (rank === 2) color = '#fa8c16';
                    else if (rank === 3) color = '#fadb14';
                    else color = '#8c8c8c';
                    return (
                      <Text strong style={{ color, fontSize: 16 }}>
                        {rank <= 3 ? <TrophyOutlined style={{ color }} /> : rank}
                      </Text>
                    );
                  },
                },
                {
                  title: '申请编号',
                  dataIndex: 'applicationNo',
                  key: 'applicationNo',
                  width: 180,
                },
                {
                  title: '事项名称',
                  dataIndex: 'matterName',
                  key: 'matterName',
                  ellipsis: true,
                },
                {
                  title: '申请人',
                  dataIndex: 'applicantName',
                  key: 'applicantName',
                  width: 100,
                },
                {
                  title: '补正次数',
                  dataIndex: 'supplementCount',
                  key: 'supplementCount',
                  width: 100,
                  sorter: (a: SupplementRepeatItem, b: SupplementRepeatItem) => a.supplementCount - b.supplementCount,
                  render: (val: number) => (
                    <Tag color={val >= 4 ? 'error' : val >= 3 ? 'warning' : 'processing'}>
                      {val} 次
                    </Tag>
                  ),
                },
                {
                  title: '补正原因',
                  dataIndex: 'reasons',
                  key: 'reasons',
                  render: (reasons: string[]) => (
                    <Space size={[4, 4]} wrap>
                      {reasons.slice(0, 3).map((r, i) => (
                        <Tag key={i} color="orange" style={{ fontSize: 12 }}>
                          {r.length > 20 ? r.substring(0, 20) + '...' : r}
                        </Tag>
                      ))}
                      {reasons.length > 3 && (
                        <Tooltip title={reasons.slice(3).join('\n')}>
                          <Tag color="default">+{reasons.length - 3}</Tag>
                        </Tooltip>
                      )}
                    </Space>
                  ),
                },
                {
                  title: '操作',
                  key: 'action',
                  width: 100,
                  render: (_: any, record: SupplementRepeatItem) => (
                    <Button
                      type="link"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJumpToApplicationDetail(record.applicationId);
                      }}
                    >
                      查看详情
                    </Button>
                  ),
                },
              ]}
            />
            {supplementAnalysis.repeatedSupplements.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                暂无重复补正申请
              </div>
            )}
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
}
