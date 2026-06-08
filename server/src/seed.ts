import db from './database';
import { createUser } from './dao/userDao';
import { createMatter } from './dao/matterDao';
import { toJSON } from './utils/helpers';

function seed() {
  console.log('🌱 开始初始化种子数据...');

  try {
    const existingAdmin = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
    if (existingAdmin) {
      console.log('ℹ️  种子数据已存在，跳过初始化');
      return;
    }

    console.log('👤 创建用户账号...');
    
    createUser({
      username: 'admin',
      password: 'admin123',
      name: '系统管理员',
      role: 'admin',
      phone: '13800000000',
    });

    createUser({
      username: 'window1',
      password: '123456',
      name: '张窗口',
      role: 'window',
      phone: '13800000001',
    });

    createUser({
      username: 'window2',
      password: '123456',
      name: '李窗口',
      role: 'window',
      phone: '13800000002',
    });

    createUser({
      username: 'reviewer1',
      password: '123456',
      name: '王审核',
      role: 'reviewer',
      phone: '13800000003',
    });

    createUser({
      username: 'reviewer2',
      password: '123456',
      name: '赵审核',
      role: 'reviewer',
      phone: '13800000004',
    });

    createUser({
      username: 'applicant1',
      password: '123456',
      name: '陈申请',
      role: 'applicant',
      phone: '13900000001',
      idCard: '110101199001011234',
    });

    createUser({
      username: 'applicant2',
      password: '123456',
      name: '刘申请',
      role: 'applicant',
      phone: '13900000002',
      idCard: '110101199202022345',
    });

    console.log('📋 创建审批事项...');

    const materials1 = toJSON([
      { name: '身份证复印件', required: true, description: '申请人身份证正反面复印件' },
      { name: '申请表', required: true, description: '填写完整的申请表' },
      { name: '证明材料', required: false, description: '相关证明文件' },
    ]);

    const flow1 = toJSON([
      { step: 1, name: '窗口受理', role: 'window', description: '窗口人员受理申请' },
      { step: 2, name: '材料审核', role: 'window', description: '窗口人员审核材料完整性' },
      { step: 3, name: '业务审核', role: 'reviewer', description: '审核人员业务审核' },
      { step: 4, name: '办结出证', role: 'window', description: '窗口人员办结发证' },
    ]);

    createMatter({
      code: 'XK001',
      name: '营业执照办理',
      department: '市场监督管理局',
      description: '企业或个体工商户营业执照的新办、变更、注销等业务',
      requiredMaterials: materials1,
      promiseDays: 5,
      flowConfig: flow1,
      status: 'active',
    });

    const materials2 = toJSON([
      { name: '身份证', required: true, description: '申请人身份证原件及复印件' },
      { name: '户口本', required: true, description: '户口本原件及复印件' },
      { name: '申请表', required: true, description: '填写完整的变更申请表' },
      { name: '相关证明', required: false, description: '变更事项相关证明材料' },
    ]);

    createMatter({
      code: 'XK002',
      name: '户籍变更登记',
      department: '公安局',
      description: '公民户口登记事项变更，包括姓名、性别、民族、出生日期等',
      requiredMaterials: materials2,
      promiseDays: 7,
      flowConfig: flow1,
      status: 'active',
    });

    const materials3 = toJSON([
      { name: '身份证', required: true, description: '申请人身份证' },
      { name: '学历证明', required: true, description: '最高学历毕业证书' },
      { name: '工作证明', required: false, description: '单位工作证明' },
      { name: '社保缴纳证明', required: true, description: '近期社保缴纳证明' },
    ]);

    createMatter({
      code: 'XK003',
      name: '社保参保登记',
      department: '人力资源和社会保障局',
      description: '办理社会保险参保登记业务',
      requiredMaterials: materials3,
      promiseDays: 3,
      flowConfig: flow1,
      status: 'active',
    });

    createMatter({
      code: 'XK004',
      name: '不动产权证书办理',
      department: '自然资源局',
      description: '不动产权利登记、发证业务',
      requiredMaterials: materials1,
      promiseDays: 10,
      flowConfig: flow1,
      status: 'active',
    });

    createMatter({
      code: 'XK005',
      name: '食品经营许可证',
      department: '市场监督管理局',
      description: '食品经营许可证的申请、变更、延续、注销',
      requiredMaterials: materials2,
      promiseDays: 15,
      flowConfig: flow1,
      status: 'inactive',
    });

    console.log('✅ 种子数据初始化完成！');
    console.log('');
    console.log('📋 测试账号：');
    console.log('   管理员:   admin / admin123');
    console.log('   窗口人员: window1 / 123456');
    console.log('   审核人员: reviewer1 / 123456');
    console.log('   申请人:   applicant1 / 123456');
    console.log('');
  } catch (error) {
    console.error('❌ 种子数据初始化失败:', error);
    throw error;
  }
}

seed();
